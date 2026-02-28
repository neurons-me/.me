import ME from "this.me";
const me = new ME() as any;
function show(step: string, focus: string[] = []) {
  const state = me.inspect({ last: 5 });
  console.log(`\n=== ${step} ===`);
  console.log("index keys:", Object.keys(state.index).sort());
  for (const p of focus) console.log(`${p} ->`, me(p));
  console.log(
    "last memory events:",
    state.memory.map((t: any) => ({ path: t.path, op: t.operator, value: t.value }))
  );
}

console.log("\n.me example: tree creation walkthrough");
me["@"]("jabellae");
show("Identity declared", [""]);
me.profile.name("Abella.e");
me.profile.bio("Building the semantic web.");
me.profile.pic("https://neurons.me/media/neurons-grey.png");
show("Own profile created", ["profile.name", "profile.bio", "profile.pic"]);
me.users.ana.name("Ana");
me.users.ana.bio("Designing semantic interfaces.");
me.users.ana.age(22);
show("users.ana created", ["users.ana.name", "users.ana.bio", "users.ana.age"]);
me.users.pablo.name("Pablo");
me.users.pablo.bio("Building distributed systems.");
me.users.pablo.age(17);
show("users.pablo created", ["users.pablo.name", "users.pablo.bio", "users.pablo.age"]);
me.friends.ana["->"]("users.ana");
me.friends.pablo["->"]("users.pablo");
show("Pointers created (friends -> users)", ["friends.ana", "friends.pablo"]);
console.log("\nPointer traversal:");
console.log("friends.ana.bio ->", me("friends.ana.bio"));
console.log("friends.pablo.name ->", me("friends.pablo.name"));
console.log("\nLogical filter result:");
console.log("friends[age > 18].name ->", me("friends[age > 18].name"));
show("Final state", [
  "profile.name",
  "friends.ana.bio",
  "friends.pablo.name",
  "friends[age > 18].name",
]);
