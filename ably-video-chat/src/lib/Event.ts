import {Contact} from "./Contact";
import {Call} from "./Call";


export class ContactChangeEvent extends Event {

  clientId: string;
  contact: Contact;

  constructor(clientId: string, contact: Contact){
    super("onContactChange");
    this.clientId = clientId;
    this.contact = contact;
  }
}

export class ContactAddEvent extends Event {
  contact: Contact;

  constructor(contact: Contact){
    super("onContactAdd");
    this.contact = contact;
  }
}

export class ContactRemoveEvent extends Event {
  contact: Contact;

  constructor(contact: Contact){
    super("onContactRemove");
    this.contact = contact;
  }
}

export class IncomingCallEvent extends Event {
  call: Call;

  constructor(call: Call){
    super("onIncomingCall");
    this.call = call;
  }
}

export class CallEstablishedEvent extends Event {

  call: Call;

  constructor(call: Call){
      super("onCallEstablished");
      this.call = call;
  }
}


export class CallEndedEvent extends Event {
  contact: Contact;

  constructor(contact: Contact){
    super("onCallEnded");
    this.contact = contact;
  }
}
