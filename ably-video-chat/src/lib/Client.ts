import {Types, Realtime} from 'ably';
import {Contact} from "./Contact";
import {Call} from "./Call";
import {
  ContactAddEvent,
  ContactChangeEvent,
  ContactRemoveEvent, IncomingCallEvent,
} from "./Event";

/**
 * The Client is the basis of all interactions with the library
 */
export class Client extends EventTarget {

  /**
   * The underlying Ably client
   */
  ably: Types.RealtimePromise;

  lobby: Types.RealtimeChannelPromise;
  incoming: Types.RealtimeChannelPromise;

  options: VideoOptions;

  contacts: Contact[] = [];
  activeCall?: Call;

  localVideo?: MediaStream;
  remoteVideo?: MediaStream;

  constructor(ablyOptions: Types.ClientOptions, videoChatOptions: VideoOptions){
    super();
    this.options = {...Defaults, ...videoChatOptions};
    this.ably = new Realtime.Promise({clientId: this.options.username,...ablyOptions});
    this.lobby = this.ably.channels.get(this.options.lobbyChannel);
    this.incoming = this.ably.channels.get(this.options.username);
    console.log("Incoming channel", this.options.username);
    this.incoming.subscribe("callRequest", this.handleCallRequest.bind(this));
    this.incoming.subscribe("callAccept", this.handleCallAccept.bind(this));
    this.initPresence();
    this.initLocalVideo();
  }

  private log(message: string){
    console.log(message);
  }

  private async initPresence(){
    // Add all current clients to the presence list
    const currentPresence = await this.lobby.presence.get();
    currentPresence.map(this.handlePresenceEnter.bind(this));
    // Handle incoming presences
    await this.lobby.presence.subscribe("enter", this.handlePresenceEnter.bind(this));
    await this.lobby.presence.subscribe("leave", this.handlePresenceLeave.bind(this));
    return this.lobby.presence.enter({username: this.options.username});
  }

  private handlePresenceEnter(message: Types.PresenceMessage){
    const existingContact = this.contactFromAblyId(message.clientId);
    if(existingContact) {
      existingContact.username = message.data.username;
      this.dispatchEvent(new ContactChangeEvent(message.clientId, existingContact))
      return this.log(`Ignoring presence enter for existing contact ${message.clientId}`);
    }

    const contact = new Contact(this, message.clientId, message.data.username)
    this.contacts.push(contact);
    this.dispatchEvent(new ContactAddEvent(contact));
  }

  private handlePresenceLeave(message: Types.PresenceMessage){
    const indexToRemove = this.contacts.findIndex((c)=>c.ablyClientId===message.clientId);
    if(indexToRemove === -1){
      return this.log(`Ignoring leave from non-existent contact ${message.clientId}`);
    }
    this.dispatchEvent(new ContactRemoveEvent(this.contacts[indexToRemove]))
    this.contacts.splice(indexToRemove, 1);
  }

  /**
   * Handle an incoming call request
   * @param message
   * @private
   */
  private handleCallRequest(message: Types.Message){
    console.log("<-callRequest");
    const contact = this.contactFromAblyId(message.clientId);
    if(!contact)return this.log("Received call request from invalid client "+message.clientId);
    // if(this.activeCall)return this.log("Tried to start new call with already active call");
    this.activeCall = new Call(this, contact);
    console.log("Active call time");
    this.dispatchEvent(new IncomingCallEvent(this.activeCall));
  }

  /**
   * Once a pending call has been accepted, we can establish the session
   * @param message
   * @private
   */
  private handleCallAccept(message: Types.Message){
    console.log("<-callAccept");
    // TODO: make sure the actual client we are calling responds
    const contact = this.contactFromAblyId(message.clientId);
    if(!contact)return this.log("Received call request from invalid client "+message.clientId);
    //if(this.activeCall)return this.log("Tried to start new call with already active call");
    this.activeCall.setup()
  }

  private contactFromAblyId(ablyId: string): Contact | undefined {
    return this.contacts.find((c)=>c.ablyClientId===ablyId);
  }

  private async initLocalVideo(){
    this.localVideo = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: {
        facingMode: "user",
        aspectRatio: {
          ideal: 1.7777777778
        }
      }
    });
  }

  /**
   * Sends a call request to a specified contact
   * @param c
   */
  callContact(c: Contact){
    // TODO: Setup a pending call in some way
    if(this.activeCall)return;
    this.activeCall = new Call(this, c);
    const outgoing = this.ably.channels.get(c.ablyClientId);
    outgoing.publish("callRequest", {});
  }
}

const Defaults: VideoOptions = {
  username: "unnamed",
  lobbyChannel: "_lobby",
}

export type VideoOptions = {
  /**
   * The username for the local client. Will be rejected if it is a duplicate.
   */
  username: string;
  /**
   * The name for the lobby channel. Defaults to `_lobby`
   */
  lobbyChannel?: string;
}
