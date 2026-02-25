import ME from "this.me";
const me: any = new ME();
// semantic writes
me.profile.name("Abella");
me.profile.age(30);
// semantic reads
const name: string = me("profile.name");
const age: number = me("profile.age");
// type check only
console.log(name, age);
