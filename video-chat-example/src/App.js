import './App.css';
import {Client} from 'ably-video-chat';
import * as React from 'react';
import { createRef } from "react";

class App extends React.Component {

  state = {
    draftUsername: "",
    contacts: [],
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
      console.log("Incoming call!");
      console.log(call);
      if(window.confirm(`Accept call from ${call.remoteContact.ablyClientId}?`)) {
        call.accept();
      }else{
        call.hangUp();
      }
    });
    this.client.addEventListener("onCallEstablished", ()=>{
      console.log("Call connected!");
      this.localVideoRef.current.srcObject = this.client.localVideo;
      this.remoteVideoRef.current.srcObject = this.client.remoteVideo;
    })
  }

  updateContacts(){
    console.log("Contacts update", this.client.contacts);
    this.setState({contacts: this.client.contacts});
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
        Contacts:
        {this.state.contacts.map((c)=><button onClick={()=>c.call()} disabled={c.ablyClientId === this.client.ably.clientId}>{c.username}</button>)}
        <video autoPlay muted ref={this.localVideoRef}/>
        <video autoPlay ref={this.remoteVideoRef}/>
      </div>
    );
  }
}

function UsernameInput({onSubmit}) {
  const [username, setUsername] = React.useState("");
  return <>
    <input type="text" placeholder="Enter a username" onChange={(e)=>setUsername(e.target.value)} value={username}></input>
    <button onClick={()=>onSubmit(username)}>Log In</button>
  </>
}

export default App;
