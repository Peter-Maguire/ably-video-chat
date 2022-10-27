/**
 * A Contact is a remote client which is available to call
 */
import {Client} from "./Client";
export class Contact {

  localClient: Client;

  ablyClientId: string;
  username: string;

  constructor(client: Client, ablyClientId: string, username: string){
    this.localClient = client;
    this.ablyClientId = ablyClientId;
    this.username = username;
  }

  call(){
    return this.localClient.callContact(this);
  }
}
