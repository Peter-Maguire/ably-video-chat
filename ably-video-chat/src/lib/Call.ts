/**
 * A call is a call between two clients
 */
import {Client} from "./Client";
import {Contact} from "./Contact";
import {compress, decompress} from "./Util";
import {CallEstablishedEvent} from "./Event";
import {Types} from "ably";

export class Call {

  localClient: Client;
  remoteContact: Contact;
  state: CallState = CallState.RINGING;

  connection: RTCPeerConnection;
  incoming: Types.RealtimeChannelPromise;

  constructor(localClient: Client, remoteContact: Contact){
    this.localClient = localClient;
    this.remoteContact = remoteContact;
    this.initIncoming();
  }

  private initIncoming(){
    this.incoming = this.localClient.ably.channels.get(this.localClient.options.username);
    this.incoming.subscribe("sessionStartRequest", this.handleSessionStartRequest.bind(this));
    this.incoming.subscribe("sessionStartAccept", this.handleSessionStartAccept.bind(this));
    this.incoming.subscribe("newIceCandidate", this.handleNewIceCandidate.bind(this));
    this.incoming.subscribe("sessionEnd", this.handleSessionEnd.bind(this));
  }

  private async handleSessionStartRequest(message: Types.Message){
    if(message.clientId !== this.remoteContact.ablyClientId)return;
    console.log("<-sessionStartRequest");
    // The SDP data is too large to send over ably, so we compress it
    const decompressedSdp = await decompress(message.data.sdp);
    // Create a new session
    const session = new RTCSessionDescription({
      type: message.data.type,
      sdp: decompressedSdp,
    });

    // Create a connection if there isn't already one
    if(!this.connection)
      await this.initConnection();

    if(this.connection.signalingState !== "stable"){
      console.log("Postponing due to unstable connection");
      await Promise.all([
        this.connection.setLocalDescription({type: "rollback"}),
        this.connection.setRemoteDescription(session)
      ]);
      return;
    }else{
      await this.connection.setRemoteDescription(session);
    }

    this.localClient.localVideo.getTracks().forEach((t)=>this.connection.addTransceiver(t, {streams: [this.localClient.localVideo]}));

    await this.connection.setLocalDescription(await this.connection.createAnswer());

    const outgoing = this.localClient.ably.channels.get(this.remoteContact.ablyClientId);
    const compressedSdp = await compress(this.connection.localDescription.sdp);
    console.log("->sessionStartAccept");
    // Accepts the session and returns SDP data for this client
    return outgoing.publish("sessionStartAccept",{
      type: this.connection.localDescription.type,
      sdp: compressedSdp,
    });
  }

  private async handleSessionStartAccept(message: Types.Message){
    if(message.clientId !== this.remoteContact.ablyClientId)return;
    const decompressedSdp = await decompress(message.data.sdp);
    const remoteSession = new RTCSessionDescription({
      type: message.data.type,
      sdp: decompressedSdp,
    });
    return this.connection.setRemoteDescription(remoteSession);
  }

  private async handleNewIceCandidate(message: Types.Message){
    if(message.clientId !== this.remoteContact.ablyClientId)return;
    console.log("<-newIceCandidate", JSON.parse(message.data));
    const candidate = new RTCIceCandidate(JSON.parse(message.data));
    return this.connection.addIceCandidate(candidate);
  }

  private async handleSessionEnd(message: Types.Message){
    if(message.clientId !== this.remoteContact.ablyClientId)return;
    console.log("<-sessionEnd");
    this.destroy();
  }

  /**
   * Initiates a call
   * @internal
   */
  async setup(){
    if(!this.connection)
      await this.initConnection();

    this.localClient.localVideo.getTracks().forEach((t)=>this.connection.addTransceiver(t, {streams: [this.localClient.localVideo]}))
  }

  private async initConnection(){
    this.state = CallState.ESTABLISHING;
    this.connection = new RTCPeerConnection({});

    this.connection.onicecandidate = this.onICECandidate.bind(this);
    this.connection.oniceconnectionstatechange = this.onICEConnectionStateChange.bind(this);
    this.connection.onsignalingstatechange = this.onSignalingStateChange.bind(this);
    this.connection.onnegotiationneeded = this.onNegotiationNeeded.bind(this);
    this.connection.ontrack = this.onTrack.bind(this);
  }

  private onICECandidate(evt: RTCPeerConnectionIceEvent){
    if(!evt.candidate)return console.log("Ignoring newicedandidate event with no candidate", evt);
    const outgoing = this.localClient.ably.channels.get(this.remoteContact.ablyClientId)
    console.log("->newIceCandidate", evt.candidate);
    return outgoing.publish("newIceCandidate", JSON.stringify(evt.candidate));
  }

  private onICEConnectionStateChange(){
    console.log("ICE State:", this.connection.iceConnectionState)
    switch(this.connection.iceConnectionState){
      case "closed":
      case "failed":
      case "disconnected":
        this.destroy();
        break;
    }
  }

  private onSignalingStateChange(){
    console.log("Signaling State:", this.connection.iceConnectionState)
    if(this.connection.signalingState === "closed")
      this.destroy();
  }

  private async onNegotiationNeeded(){
    console.log("Beginning negotiation");
    console.log(this.connection.signalingState);
    console.log(this.connection.iceConnectionState);
    const offer = await this.connection.createOffer();
    if(this.connection.signalingState !== "stable"){
      console.log("Postponing due to unstable signaling state")
      return;
    }

    await this.connection.setLocalDescription(offer);

    const compressedSdp = await compress(offer.sdp);
    const outgoing = this.localClient.ably.channels.get(this.remoteContact.ablyClientId);
    console.log("->sessionStartRequest");
    return outgoing.publish("sessionStartRequest", {type: offer.type, sdp: compressedSdp});
  }

  private onTrack(evt: RTCTrackEvent){
    console.log("** RECV TRACK");
    this.localClient.remoteVideo = evt.streams[0];
    this.localClient.dispatchEvent(new CallEstablishedEvent(this));
    console.log("The call is ready");
  }

  destroy(){
    if(this.connection) {
      this.connection.onicecandidate = null;
      this.connection.oniceconnectionstatechange = null;
      this.connection.onicegatheringstatechange = null;
      this.connection.onsignalingstatechange = null;
      this.connection.onnegotiationneeded = null;
      this.connection.ontrack = null;

      this.connection.getTransceivers().forEach((tx) => tx.stop());

      this.connection.close();
      this.connection = null;
    }

    this.incoming.unsubscribe("sessionStartRequest");
    this.incoming.unsubscribe("sessionStartAccept");
    this.incoming.unsubscribe("newIceCandidate");
    this.incoming.unsubscribe("sessionEnd");

    // TODO: move this somewhere less icky
    this.localClient.activeCall = null;
    const outgoing = this.localClient.ably.channels.get(this.remoteContact.ablyClientId)
    console.log("->sessionEnd");
    return outgoing.publish("sessionEnd", {});
  }


  /**
   * Accepts the call, allowing the other client to start establishing a connection
   */
  accept(){
    // TODO: check state
    const outgoing = this.localClient.ably.channels.get(this.remoteContact.ablyClientId);
    console.log("->callAccept");
    outgoing.publish("callAccept", {});
  }

  hangUp(){
    // TODO: call decline message
    this.destroy();
  }
}

export enum CallState {
  RINGING,
  ESTABLISHING,
  ACTIVE,
}
