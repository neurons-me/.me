import{_ as a,o as n,c as i,ae as p}from"./chunks/framework.CVHnLOl0.js";const d=JSON.parse('{"title":"𓂀 Social Graph Walkthrough","description":"","frontmatter":{},"headers":[],"relativePath":"examples/Social_Graph.md","filePath":"examples/Social_Graph.md"}'),l={name:"examples/Social_Graph.md"};function e(t,s,h,k,r,E){return n(),i("div",null,[...s[0]||(s[0]=[p(`<h1 id="𓂀-social-graph-walkthrough" tabindex="-1">𓂀 Social Graph Walkthrough <a class="header-anchor" href="#𓂀-social-graph-walkthrough" aria-label="Permalink to &quot;𓂀 Social Graph Walkthrough&quot;">​</a></h1><p>This example builds a small social graph in <code>.me</code> and shows how state evolves at each step using <code>inspect()</code>.</p><p>It demonstrates:</p><ul><li>identity declaration (<code>@</code>)</li><li>tree creation with semantic paths</li><li>pointer bridges (<code>-&gt;</code>)</li><li>pointer traversal</li><li>logical filtering with selectors (<code>[age &gt; 18]</code>)</li><li>memory log inspection</li></ul><hr><h2 id="full-script" tabindex="-1">Full Script <a class="header-anchor" href="#full-script" aria-label="Permalink to &quot;Full Script&quot;">​</a></h2><div class="language-ts vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">ts</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">import</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> ME </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">from</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> &quot;this.me&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">;</span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> me</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> new</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> ME</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">() </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">as</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> any</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">;</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">function</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> show</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#E36209;--shiki-dark:#FFAB70;">step</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">:</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> string</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, </span><span style="--shiki-light:#E36209;--shiki-dark:#FFAB70;">focus</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">:</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> string</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">[] </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">=</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> []) {</span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">  const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> state</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> me.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">inspect</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">({ last: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">5</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> });</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  console.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">log</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">\`</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">\\n</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">=== \${</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">step</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">} ===\`</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">);</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  console.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">log</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;index keys:&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, Object.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">keys</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(state.index).</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">sort</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">());</span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">  for</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> (</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> p</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> of</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> focus) console.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">log</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">\`\${</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">p</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">} -&gt;\`</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, </span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">me</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(p));</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  console.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">log</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span></span>
<span class="line"><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">    &quot;last memory events:&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">,</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    state.memory.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">map</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">((</span><span style="--shiki-light:#E36209;--shiki-dark:#FFAB70;">t</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">:</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> any</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">) </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">=&gt;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> ({ path: t.path, op: t.operator, value: t.value }))</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  );</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">}</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">console.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">log</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">\\n</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">.me example: tree creation walkthrough&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">);</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">me[</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;@&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">](</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;jabellae&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">);</span></span>
<span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">show</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;Identity declared&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, [</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">]);</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">me.profile.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">name</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;Abella.e&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">);</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">me.profile.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">bio</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;Building the semantic web.&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">);</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">me.profile.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">pic</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;https://neurons.me/media/neurons-grey.png&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">);</span></span>
<span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">show</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;Own profile created&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, [</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;profile.name&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;profile.bio&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;profile.pic&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">]);</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">me.users.ana.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">name</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;Ana&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">);</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">me.users.ana.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">bio</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;Designing semantic interfaces.&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">);</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">me.users.ana.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">age</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">22</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">);</span></span>
<span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">show</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;users.ana created&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, [</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;users.ana.name&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;users.ana.bio&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;users.ana.age&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">]);</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">me.users.pablo.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">name</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;Pablo&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">);</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">me.users.pablo.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">bio</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;Building distributed systems.&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">);</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">me.users.pablo.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">age</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">17</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">);</span></span>
<span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">show</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;users.pablo created&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, [</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;users.pablo.name&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;users.pablo.bio&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;users.pablo.age&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">]);</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">me.friends.ana[</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;-&gt;&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">](</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;users.ana&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">);</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">me.friends.pablo[</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;-&gt;&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">](</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;users.pablo&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">);</span></span>
<span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">show</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;Pointers created (friends -&gt; users)&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, [</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;friends.ana&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;friends.pablo&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">]);</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">console.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">log</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">\\n</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">Pointer traversal:&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">);</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">console.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">log</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;friends.ana.bio -&gt;&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, </span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">me</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;friends.ana.bio&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">));</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">console.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">log</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;friends.pablo.name -&gt;&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, </span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">me</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;friends.pablo.name&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">));</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">console.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">log</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">\\n</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">Logical filter result:&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">);</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">console.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">log</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;friends[age &gt; 18].name -&gt;&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, </span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">me</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;friends[age &gt; 18].name&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">));</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">show</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;Final state&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, [</span></span>
<span class="line"><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">  &quot;profile.name&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">,</span></span>
<span class="line"><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">  &quot;friends.ana.bio&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">,</span></span>
<span class="line"><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">  &quot;friends.pablo.name&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">,</span></span>
<span class="line"><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">  &quot;friends[age &gt; 18].name&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">,</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">]);</span></span></code></pre></div><hr><h2 id="step-by-step-meaning" tabindex="-1">Step-by-Step Meaning <a class="header-anchor" href="#step-by-step-meaning" aria-label="Permalink to &quot;Step-by-Step Meaning&quot;">​</a></h2><h3 id="_1-identity-root" tabindex="-1">1) Identity root <a class="header-anchor" href="#_1-identity-root" aria-label="Permalink to &quot;1) Identity root&quot;">​</a></h3><div class="language-ts vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">ts</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">me[</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;@&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">](</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;jabellae&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">);</span></span></code></pre></div><ul><li>Declares canonical identity at root.</li><li>Writes an <code>@</code> memory event.</li></ul><h3 id="_2-local-profile" tabindex="-1">2) Local profile <a class="header-anchor" href="#_2-local-profile" aria-label="Permalink to &quot;2) Local profile&quot;">​</a></h3><div class="language-ts vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">ts</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">me.profile.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">name</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;Abella.e&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">);</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">me.profile.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">bio</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;Building the semantic web.&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">);</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">me.profile.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">pic</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;https://neurons.me/media/neurons-grey.png&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">);</span></span></code></pre></div><ul><li>Creates direct public leaves under <code>profile.*</code>.</li><li>These are normal path-value commits.</li></ul><h3 id="_3-user-nodes" tabindex="-1">3) User nodes <a class="header-anchor" href="#_3-user-nodes" aria-label="Permalink to &quot;3) User nodes&quot;">​</a></h3><div class="language-ts vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">ts</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">me.users.ana.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">age</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">22</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">);</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">me.users.pablo.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">age</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">17</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">);</span></span></code></pre></div><ul><li>Builds two separate user subtrees.</li><li>Enables later filtering logic by age.</li></ul><h3 id="_4-graph-edges-via-pointers" tabindex="-1">4) Graph edges via pointers <a class="header-anchor" href="#_4-graph-edges-via-pointers" aria-label="Permalink to &quot;4) Graph edges via pointers&quot;">​</a></h3><div class="language-ts vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">ts</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">me.friends.ana[</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;-&gt;&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">](</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;users.ana&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">);</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">me.friends.pablo[</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;-&gt;&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">](</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;users.pablo&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">);</span></span></code></pre></div><ul><li><code>friends.*</code> nodes become structural pointers (<code>{ __ptr: &quot;users.*&quot; }</code>).</li><li>Reading deeper paths traverses the pointer target.</li></ul><h3 id="_5-pointer-traversal" tabindex="-1">5) Pointer traversal <a class="header-anchor" href="#_5-pointer-traversal" aria-label="Permalink to &quot;5) Pointer traversal&quot;">​</a></h3><div class="language-ts vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">ts</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">me</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;friends.ana.bio&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">);    </span><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">// resolves to users.ana.bio</span></span>
<span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">me</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;friends.pablo.name&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">); </span><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">// resolves to users.pablo.name</span></span></code></pre></div><ul><li>Confirms relational read works without duplicating data.</li></ul><h3 id="_6-logical-selector-filter" tabindex="-1">6) Logical selector filter <a class="header-anchor" href="#_6-logical-selector-filter" aria-label="Permalink to &quot;6) Logical selector filter&quot;">​</a></h3><div class="language-ts vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">ts</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">me</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;friends[age &gt; 18].name&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">);</span></span></code></pre></div><ul><li>Evaluates condition per child in <code>friends</code>.</li><li>Expected result: only <code>ana</code> passes (<code>22 &gt; 18</code>), <code>pablo</code> is excluded (<code>17</code>).</li></ul><hr><h2 id="why-show-matters" tabindex="-1">Why <code>show(...)</code> matters <a class="header-anchor" href="#why-show-matters" aria-label="Permalink to &quot;Why \`show(...)\` matters&quot;">​</a></h2><p><code>show()</code> prints three planes after each mutation:</p><ul><li><code>index keys</code>: current public resolved surface</li><li>focused reads: direct proof of expected values</li><li><code>last memory events</code>: latest commits from <code>state.memory</code></li></ul><p>This gives you a real-time audit trail of how <code>.me</code> builds and resolves the graph.</p><hr><h2 id="run" tabindex="-1">Run <a class="header-anchor" href="#run" aria-label="Permalink to &quot;Run&quot;">​</a></h2><div class="language-bash vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">bash</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">node</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> tests/Social_Graph.ts</span></span></code></pre></div><p>If output is correct, your graph, pointers, and filter logic are all working together.</p><hr><h2 id="runtime-output-real" tabindex="-1">Runtime Output (real) <a class="header-anchor" href="#runtime-output-real" aria-label="Permalink to &quot;Runtime Output (real)&quot;">​</a></h2><div class="language-txt vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">txt</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>suign@Suis-MacBook-Air npm % node tests/example.ts </span></span>
<span class="line"><span></span></span>
<span class="line"><span>.me example: tree creation walkthrough</span></span>
<span class="line"><span></span></span>
<span class="line"><span>=== Identity declared ===</span></span>
<span class="line"><span>index keys: [ &#39;&#39; ]</span></span>
<span class="line"><span> -&gt; {</span></span>
<span class="line"><span>  path: &#39;&#39;,</span></span>
<span class="line"><span>  operator: null,</span></span>
<span class="line"><span>  expression: &#39;&#39;,</span></span>
<span class="line"><span>  value: &#39;&#39;,</span></span>
<span class="line"><span>  effectiveSecret: &#39;&#39;,</span></span>
<span class="line"><span>  hash: &#39;4cce34b7&#39;,</span></span>
<span class="line"><span>  prevHash: &#39;3f1c0ad3&#39;,</span></span>
<span class="line"><span>  timestamp: 1772255707955</span></span>
<span class="line"><span>}</span></span>
<span class="line"><span>last memory events: [ { path: &#39;&#39;, op: &#39;@&#39;, value: { __id: &#39;jabellae&#39; } } ]</span></span>
<span class="line"><span></span></span>
<span class="line"><span>=== Own profile created ===</span></span>
<span class="line"><span>index keys: [ &#39;&#39;, &#39;profile.bio&#39;, &#39;profile.name&#39;, &#39;profile.pic&#39; ]</span></span>
<span class="line"><span>profile.name -&gt; Abella.e</span></span>
<span class="line"><span>profile.bio -&gt; Building the semantic web.</span></span>
<span class="line"><span>profile.pic -&gt; https://neurons.me/media/neurons-grey.png</span></span>
<span class="line"><span>last memory events: [</span></span>
<span class="line"><span>  { path: &#39;&#39;, op: &#39;@&#39;, value: { __id: &#39;jabellae&#39; } },</span></span>
<span class="line"><span>  { path: &#39;&#39;, op: null, value: &#39;&#39; },</span></span>
<span class="line"><span>  { path: &#39;profile.name&#39;, op: null, value: &#39;Abella.e&#39; },</span></span>
<span class="line"><span>  {</span></span>
<span class="line"><span>    path: &#39;profile.bio&#39;,</span></span>
<span class="line"><span>    op: null,</span></span>
<span class="line"><span>    value: &#39;Building the semantic web.&#39;</span></span>
<span class="line"><span>  },</span></span>
<span class="line"><span>  {</span></span>
<span class="line"><span>    path: &#39;profile.pic&#39;,</span></span>
<span class="line"><span>    op: null,</span></span>
<span class="line"><span>    value: &#39;https://neurons.me/media/neurons-grey.png&#39;</span></span>
<span class="line"><span>  }</span></span>
<span class="line"><span>]</span></span>
<span class="line"><span></span></span>
<span class="line"><span>=== users.ana created ===</span></span>
<span class="line"><span>index keys: [</span></span>
<span class="line"><span>  &#39;&#39;,</span></span>
<span class="line"><span>  &#39;profile.bio&#39;,</span></span>
<span class="line"><span>  &#39;profile.name&#39;,</span></span>
<span class="line"><span>  &#39;profile.pic&#39;,</span></span>
<span class="line"><span>  &#39;users.ana.age&#39;,</span></span>
<span class="line"><span>  &#39;users.ana.bio&#39;,</span></span>
<span class="line"><span>  &#39;users.ana.name&#39;</span></span>
<span class="line"><span>]</span></span>
<span class="line"><span>users.ana.name -&gt; Ana</span></span>
<span class="line"><span>users.ana.bio -&gt; Designing semantic interfaces.</span></span>
<span class="line"><span>users.ana.age -&gt; 22</span></span>
<span class="line"><span>last memory events: [</span></span>
<span class="line"><span>  {</span></span>
<span class="line"><span>    path: &#39;profile.bio&#39;,</span></span>
<span class="line"><span>    op: null,</span></span>
<span class="line"><span>    value: &#39;Building the semantic web.&#39;</span></span>
<span class="line"><span>  },</span></span>
<span class="line"><span>  {</span></span>
<span class="line"><span>    path: &#39;profile.pic&#39;,</span></span>
<span class="line"><span>    op: null,</span></span>
<span class="line"><span>    value: &#39;https://neurons.me/media/neurons-grey.png&#39;</span></span>
<span class="line"><span>  },</span></span>
<span class="line"><span>  { path: &#39;users.ana.name&#39;, op: null, value: &#39;Ana&#39; },</span></span>
<span class="line"><span>  {</span></span>
<span class="line"><span>    path: &#39;users.ana.bio&#39;,</span></span>
<span class="line"><span>    op: null,</span></span>
<span class="line"><span>    value: &#39;Designing semantic interfaces.&#39;</span></span>
<span class="line"><span>  },</span></span>
<span class="line"><span>  { path: &#39;users.ana.age&#39;, op: null, value: 22 }</span></span>
<span class="line"><span>]</span></span>
<span class="line"><span></span></span>
<span class="line"><span>=== users.pablo created ===</span></span>
<span class="line"><span>index keys: [</span></span>
<span class="line"><span>  &#39;&#39;,</span></span>
<span class="line"><span>  &#39;profile.bio&#39;,</span></span>
<span class="line"><span>  &#39;profile.name&#39;,</span></span>
<span class="line"><span>  &#39;profile.pic&#39;,</span></span>
<span class="line"><span>  &#39;users.ana.age&#39;,</span></span>
<span class="line"><span>  &#39;users.ana.bio&#39;,</span></span>
<span class="line"><span>  &#39;users.ana.name&#39;,</span></span>
<span class="line"><span>  &#39;users.pablo.age&#39;,</span></span>
<span class="line"><span>  &#39;users.pablo.bio&#39;,</span></span>
<span class="line"><span>  &#39;users.pablo.name&#39;</span></span>
<span class="line"><span>]</span></span>
<span class="line"><span>users.pablo.name -&gt; Pablo</span></span>
<span class="line"><span>users.pablo.bio -&gt; Building distributed systems.</span></span>
<span class="line"><span>users.pablo.age -&gt; 17</span></span>
<span class="line"><span>last memory events: [</span></span>
<span class="line"><span>  {</span></span>
<span class="line"><span>    path: &#39;users.ana.bio&#39;,</span></span>
<span class="line"><span>    op: null,</span></span>
<span class="line"><span>    value: &#39;Designing semantic interfaces.&#39;</span></span>
<span class="line"><span>  },</span></span>
<span class="line"><span>  { path: &#39;users.ana.age&#39;, op: null, value: 22 },</span></span>
<span class="line"><span>  { path: &#39;users.pablo.name&#39;, op: null, value: &#39;Pablo&#39; },</span></span>
<span class="line"><span>  {</span></span>
<span class="line"><span>    path: &#39;users.pablo.bio&#39;,</span></span>
<span class="line"><span>    op: null,</span></span>
<span class="line"><span>    value: &#39;Building distributed systems.&#39;</span></span>
<span class="line"><span>  },</span></span>
<span class="line"><span>  { path: &#39;users.pablo.age&#39;, op: null, value: 17 }</span></span>
<span class="line"><span>]</span></span>
<span class="line"><span></span></span>
<span class="line"><span>=== Pointers created (friends -&gt; users) ===</span></span>
<span class="line"><span>index keys: [</span></span>
<span class="line"><span>  &#39;&#39;,</span></span>
<span class="line"><span>  &#39;friends.ana&#39;,</span></span>
<span class="line"><span>  &#39;friends.pablo&#39;,</span></span>
<span class="line"><span>  &#39;profile.bio&#39;,</span></span>
<span class="line"><span>  &#39;profile.name&#39;,</span></span>
<span class="line"><span>  &#39;profile.pic&#39;,</span></span>
<span class="line"><span>  &#39;users.ana.age&#39;,</span></span>
<span class="line"><span>  &#39;users.ana.bio&#39;,</span></span>
<span class="line"><span>  &#39;users.ana.name&#39;,</span></span>
<span class="line"><span>  &#39;users.pablo.age&#39;,</span></span>
<span class="line"><span>  &#39;users.pablo.bio&#39;,</span></span>
<span class="line"><span>  &#39;users.pablo.name&#39;</span></span>
<span class="line"><span>]</span></span>
<span class="line"><span>friends.ana -&gt; { __ptr: &#39;users.ana&#39; }</span></span>
<span class="line"><span>friends.pablo -&gt; { __ptr: &#39;users.pablo&#39; }</span></span>
<span class="line"><span>last memory events: [</span></span>
<span class="line"><span>  { path: &#39;users.pablo.name&#39;, op: null, value: &#39;Pablo&#39; },</span></span>
<span class="line"><span>  {</span></span>
<span class="line"><span>    path: &#39;users.pablo.bio&#39;,</span></span>
<span class="line"><span>    op: null,</span></span>
<span class="line"><span>    value: &#39;Building distributed systems.&#39;</span></span>
<span class="line"><span>  },</span></span>
<span class="line"><span>  { path: &#39;users.pablo.age&#39;, op: null, value: 17 },</span></span>
<span class="line"><span>  { path: &#39;friends.ana&#39;, op: &#39;__&#39;, value: { __ptr: &#39;users.ana&#39; } },</span></span>
<span class="line"><span>  { path: &#39;friends.pablo&#39;, op: &#39;__&#39;, value: { __ptr: &#39;users.pablo&#39; } }</span></span>
<span class="line"><span>]</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Pointer traversal:</span></span>
<span class="line"><span>friends.ana.bio -&gt; Designing semantic interfaces.</span></span>
<span class="line"><span>friends.pablo.name -&gt; Pablo</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Logical filter result:</span></span>
<span class="line"><span>friends[age &gt; 18].name -&gt; { ana: &#39;Ana&#39; }</span></span>
<span class="line"><span></span></span>
<span class="line"><span>=== Final state ===</span></span>
<span class="line"><span>index keys: [</span></span>
<span class="line"><span>  &#39;&#39;,</span></span>
<span class="line"><span>  &#39;friends.ana&#39;,</span></span>
<span class="line"><span>  &#39;friends.pablo&#39;,</span></span>
<span class="line"><span>  &#39;profile.bio&#39;,</span></span>
<span class="line"><span>  &#39;profile.name&#39;,</span></span>
<span class="line"><span>  &#39;profile.pic&#39;,</span></span>
<span class="line"><span>  &#39;users.ana.age&#39;,</span></span>
<span class="line"><span>  &#39;users.ana.bio&#39;,</span></span>
<span class="line"><span>  &#39;users.ana.name&#39;,</span></span>
<span class="line"><span>  &#39;users.pablo.age&#39;,</span></span>
<span class="line"><span>  &#39;users.pablo.bio&#39;,</span></span>
<span class="line"><span>  &#39;users.pablo.name&#39;</span></span>
<span class="line"><span>]</span></span>
<span class="line"><span>profile.name -&gt; Abella.e</span></span>
<span class="line"><span>friends.ana.bio -&gt; Designing semantic interfaces.</span></span>
<span class="line"><span>friends.pablo.name -&gt; Pablo</span></span>
<span class="line"><span>friends[age &gt; 18].name -&gt; { ana: &#39;Ana&#39; }</span></span>
<span class="line"><span>last memory events: [</span></span>
<span class="line"><span>  { path: &#39;users.pablo.name&#39;, op: null, value: &#39;Pablo&#39; },</span></span>
<span class="line"><span>  {</span></span>
<span class="line"><span>    path: &#39;users.pablo.bio&#39;,</span></span>
<span class="line"><span>    op: null,</span></span>
<span class="line"><span>    value: &#39;Building distributed systems.&#39;</span></span>
<span class="line"><span>  },</span></span>
<span class="line"><span>  { path: &#39;users.pablo.age&#39;, op: null, value: 17 },</span></span>
<span class="line"><span>  { path: &#39;friends.ana&#39;, op: &#39;__&#39;, value: { __ptr: &#39;users.ana&#39; } },</span></span>
<span class="line"><span>  { path: &#39;friends.pablo&#39;, op: &#39;__&#39;, value: { __ptr: &#39;users.pablo&#39; } }</span></span>
<span class="line"><span>]</span></span>
<span class="line"><span>suign@Suis-MacBook-Air npm %</span></span></code></pre></div>`,39)])])}const g=a(l,[["render",e]]);export{d as __pageData,g as default};
