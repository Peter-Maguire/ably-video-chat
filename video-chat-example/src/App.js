import './App.css';
import {Client} from 'ably-video-chat';
import * as React from 'react';
import { createRef } from "react";

class App extends React.Component {

  state = {
    contacts: [],
    inCall: false,
  }
  client;

  localVideoRef = createRef();
  remoteVideoRef = createRef();

  createClient() {
    console.log("Component mount, making client");
    if(this.client)return console.log("Ignoring reload");

    this.client = new Client({key: "RUhpyA.eNjWvw:O5J_HASit3mcAyY0w6-QODsgbVlxmkNfEnMbWKRCql4"}, {username: this.state.username});
    this.updateContacts();
    this.client.addEventListener("onContactAdd", this.updateContacts.bind(this));
    this.client.addEventListener("onContactRemove", this.updateContacts.bind(this));
    this.client.addEventListener("onIncomingCall", ({ call })=>{
      if(window.confirm(`Accept call from ${call.remoteContact.ablyClientId}?`)) {
        call.accept();
      }else{
        call.hangUp();
      }
    });
    this.client.addEventListener("onCallEstablished", ()=>{
      this.setState({inCall: true})
      this.localVideoRef.current.srcObject = this.client.localVideo;
      this.remoteVideoRef.current.srcObject = this.client.remoteVideo;
    });
    this.client.addEventListener("onCallEnded", ()=>{
      this.setState({inCall: false});
      window.alert("Call Ended");
    })
  }

  updateContacts(){
    console.log("Contacts update", this.client.contacts);
    this.setState({contacts: this.client.contacts});
  }

  hangUp(){
    this.client.activeCall.hangUp();
    this.setState({inCall: false});
  }

  call(c){
    c.call();
    this.setState({inCall: true});
  }

  render(){
    if(!this.state.username){
      return (
        <div className="App">
          <UsernameInput onSubmit={(username)=>this.setState({username}, ()=>this.createClient())}></UsernameInput>
        </div>
      )
    }
    return (
      <div className="App">
        <div id="contactsList">
          <h1>Contacts:</h1>
          {this.state.contacts.map((c)=><button className="contact" onClick={()=>this.call(c)} disabled={this.state.inCall || c.ablyClientId === this.state.username}>📞 {c.username}</button>)}
          <hr/>
          <button onClick={this.hangUp} disabled={!this.state.inCall}>Hang Up</button>
        </div>
        <video autoPlay muted ref={this.localVideoRef}/>
        <video autoPlay ref={this.remoteVideoRef}/>
      </div>
    );
  }
}

function UsernameInput({onSubmit}) {
  const [username, setUsername] = React.useState("");
  return <div id="login">
    <input type="text" placeholder="Enter a username" onChange={(e)=>setUsername(e.target.value)} value={username}></input>
    <button onClick={()=>onSubmit(username)}>Log In</button>
  </div>
}

export default App;
