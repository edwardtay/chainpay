export function getDashboardHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ChainPay</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #fafafa; --card: #fff; --border: #e5e7eb; --border2: #f3f4f6;
      --text: #111827; --text2: #6b7280; --text3: #9ca3af;
      --accent: #10b981; --accent2: #059669; --blue: #3b82f6; --red: #ef4444; --purple: #8b5cf6; --orange: #f59e0b;
      --shadow: 0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04);
      --shadow2: 0 4px 6px rgba(0,0,0,.05), 0 2px 4px rgba(0,0,0,.03);
    }
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: 'Inter', -apple-system, sans-serif; background: var(--bg); color: var(--text); font-size: 14px; -webkit-font-smoothing: antialiased; }

    nav { background: #fff; border-bottom: 1px solid var(--border); padding: 0 24px; height: 56px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 10; }
    .logo { font-size: 18px; font-weight: 700; letter-spacing: -0.5px; }
    .logo em { font-style: normal; color: var(--accent); }
    .pills { display: flex; gap: 6px; }
    .pill { padding: 4px 10px; border-radius: 100px; font-size: 11px; font-weight: 500; background: var(--border2); color: var(--text2); }

    .wrap { max-width: 1120px; margin: 0 auto; padding: 24px 20px 60px; }

    .kpi { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin-bottom: 24px; }
    .kpi-card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 18px 20px; box-shadow: var(--shadow); }
    .kpi-label { font-size: 11px; text-transform: uppercase; letter-spacing: .6px; color: var(--text3); font-weight: 600; }
    .kpi-val { font-size: 28px; font-weight: 700; color: var(--accent); margin-top: 4px; line-height: 1; }
    .kpi-sub { font-size: 11px; color: var(--text3); margin-top: 6px; }

    .toolbar { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; align-items: center; }
    .btn { padding: 7px 14px; border-radius: 8px; border: 1px solid var(--border); background: #fff; color: var(--text); cursor: pointer; font-size: 13px; font-weight: 500; font-family: inherit; transition: all .12s; box-shadow: var(--shadow); }
    .btn:hover { border-color: var(--accent); color: var(--accent); }
    .btn-go { background: var(--accent); border-color: var(--accent2); color: #fff; }
    .btn-go:hover { background: var(--accent2); }
    .btn-s { padding: 5px 10px; font-size: 12px; box-shadow: none; }

    .grid { display: grid; gap: 16px; margin-bottom: 20px; }
    .g2 { grid-template-columns: 1fr 1fr; }
    .g73 { grid-template-columns: 7fr 3fr; }

    .card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; box-shadow: var(--shadow); overflow: hidden; }
    .card-h { padding: 14px 18px; border-bottom: 1px solid var(--border2); display: flex; align-items: center; justify-content: space-between; }
    .card-h h3 { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .5px; color: var(--text2); }
    .card-b { padding: 18px; }
    .card-b.scroll { max-height: 260px; overflow-y: auto; }

    .tag { display: inline-block; padding: 2px 8px; border-radius: 100px; font-size: 10px; font-weight: 600; }
    .tag-g { background: #d1fae5; color: #065f46; }
    .tag-r { background: #fee2e2; color: #991b1b; }
    .tag-b { background: #dbeafe; color: #1e40af; }
    .tag-p { background: #ede9fe; color: #5b21b6; }

    .chat-row { display: flex; gap: 8px; }
    .chat-row input { flex:1; padding: 10px 14px; border-radius: 10px; border: 1px solid var(--border); font-size: 13px; font-family: inherit; outline: none; background: var(--bg); }
    .chat-row input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px #10b98122; }
    #out { background: var(--bg); border: 1px solid var(--border); border-radius: 10px; padding: 14px; margin-top: 12px; font-family: 'SF Mono','Fira Code',monospace; font-size: 12px; line-height: 1.6; white-space: pre-wrap; max-height: 280px; overflow-y: auto; color: var(--text2); }

    .flow-bar { display: flex; align-items: center; justify-content: center; gap: 3px; padding: 14px 16px; flex-wrap: wrap; }
    .fn { padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: 600; }
    .fn-a { background: #eff6ff; color: var(--blue); }
    .fn-p { background: #ecfdf5; color: var(--accent2); }
    .fn-d { background: #fef2f2; color: var(--red); }
    .fn-ai { background: #f5f3ff; color: var(--purple); }
    .fa { color: var(--text3); font-size: 14px; margin: 0 2px; }

    .row { padding: 10px 16px; border-bottom: 1px solid var(--border2); display: flex; justify-content: space-between; align-items: center; }
    .row:last-child { border: none; }
    .row-t { font-weight: 500; font-size: 13px; }
    .row-m { font-size: 11px; color: var(--text3); }
    .row-p { font-family: 'SF Mono',monospace; font-weight: 600; color: var(--accent); font-size: 13px; }

    .ev { padding: 8px 12px; border-left: 3px solid var(--border); margin-bottom: 4px; border-radius: 0 6px 6px 0; font-size: 12px; }
    .ev-g { border-color: var(--accent); background: #f0fdf4; }
    .ev-r { border-color: var(--red); background: #fef2f2; }
    .ev-p { border-color: var(--purple); background: #faf5ff; }
    .ev b { font-size: 10px; text-transform: uppercase; letter-spacing: .3px; }

    .fg { margin-bottom: 10px; }
    .fg label { display: block; font-size: 11px; font-weight: 600; color: var(--text2); text-transform: uppercase; letter-spacing: .4px; margin-bottom: 4px; }
    .fg input, .fg select, .fg textarea { width:100%; padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border); font-size: 13px; font-family: inherit; background: var(--bg); }
    .fg textarea { min-height: 44px; resize: vertical; }
    .fr { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

    #demo-box { display: none; }
    #demo-box.on { display: block; }
    #demo-pre { font-family: 'SF Mono',monospace; font-size: 12px; color: var(--accent2); line-height: 1.7; }

    @media (max-width: 768px) { .kpi,.g2,.g73 { grid-template-columns: 1fr; } nav { padding: 0 16px; } .wrap { padding: 16px; } }
  </style>
</head>
<body>
  <nav>
    <div class="logo">Chain<em>Pay</em></div>
    <div class="pills">
      <span class="pill">Tether WDK</span>
      <span class="pill">x402</span>
      <span class="pill">Claude AI</span>
      <span class="pill">7 Chains</span>
    </div>
  </nav>

  <section style="background:#fff;border-bottom:1px solid var(--border);padding:48px 20px;text-align:center">
    <div style="max-width:640px;margin:0 auto">
      <h1 style="font-size:36px;font-weight:700;letter-spacing:-1px;line-height:1.2">The commerce protocol<br>for <span style="color:var(--accent)">autonomous agents</span></h1>
      <p style="color:var(--text2);margin:16px 0 24px;font-size:15px;line-height:1.6">Agents publish services, negotiate prices, escrow USDT, validate deliverables with AI, and settle payments across 7 chains. Self-custodial. No intermediaries.</p>
      <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
        <a href="#app" class="btn btn-go" style="text-decoration:none;padding:10px 24px">Open App</a>
        <a href="https://github.com/edwardtay/chainpay" target="_blank" class="btn" style="text-decoration:none;padding:10px 24px">GitHub</a>
      </div>
      <div style="display:flex;gap:20px;justify-content:center;margin-top:32px;color:var(--text3);font-size:12px;font-weight:500">
        <span>9 WDK Packages</span>
        <span>6 Payment Protocols</span>
        <span>200 Tests</span>
        <span>7 Chains</span>
      </div>
    </div>
  </section>

  <section style="background:var(--bg);padding:32px 20px 0">
    <div style="max-width:800px;margin:0 auto;display:grid;grid-template-columns:repeat(3,1fr);gap:16px;text-align:center">
      <div style="padding:20px"><div style="font-size:24px;margin-bottom:8px">&#x1f91d;</div><div style="font-weight:600;margin-bottom:4px">Escrow + AI Validation</div><div style="font-size:12px;color:var(--text2)">Funds locked until Claude AI approves delivery quality</div></div>
      <div style="padding:20px"><div style="font-size:24px;margin-bottom:8px">&#x1f4b1;</div><div style="font-weight:600;margin-bottom:4px">x402 Micropayments</div><div style="font-size:12px;color:var(--text2)">HTTP-native pay-per-API-call. Agents auto-pay USDT</div></div>
      <div style="padding:20px"><div style="font-size:24px;margin-bottom:8px">&#x2696;&#xfe0f;</div><div style="font-weight:600;margin-bottom:4px">AI Dispute Resolution</div><div style="font-size:12px;color:var(--text2)">Rejected deliverables go to AI arbitration</div></div>
    </div>
  </section>

  <div class="wrap" id="app">
    <div class="kpi">
      <div class="kpi-card"><div class="kpi-label">Status</div><div class="kpi-val" id="s-status">Online</div><div class="kpi-sub">Brain: <span id="s-brain" style="color:var(--red)">off</span></div></div>
      <div class="kpi-card"><div class="kpi-label">Escrowed</div><div class="kpi-val" id="s-esc">0.00</div><div class="kpi-sub">USDT in escrow</div></div>
      <div class="kpi-card"><div class="kpi-label">Services</div><div class="kpi-val" id="s-svc">0</div><div class="kpi-sub">On marketplace</div></div>
      <div class="kpi-card"><div class="kpi-label">Actions</div><div class="kpi-val" id="s-act">0</div><div class="kpi-sub">AI decisions</div></div>
    </div>

    <div class="toolbar">
      <button class="btn btn-go" onclick="runDemo()" id="demoBtn">Run Demo</button>
      <button class="btn" onclick="toggleBrain()" id="brainBtn">Start Brain</button>
      <span style="width:1px;height:20px;background:var(--border);margin:0 4px"></span>
      <button class="btn btn-s" onclick="api('/api/addresses')">Addresses</button>
      <button class="btn btn-s" onclick="api('/api/balances')">Balances</button>
      <button class="btn btn-s" onclick="api('/api/services')">Services</button>
      <button class="btn btn-s" onclick="api('/api/escrows')">Escrows</button>
      <button class="btn btn-s" onclick="api('/api/negotiations')">Negotiations</button>
      <button class="btn btn-s" onclick="api('/api/disputes')">Disputes</button>
      <button class="btn btn-s" onclick="api('/api/subscriptions')">Subs</button>
      <button class="btn btn-s" onclick="window.open('/api/audit')">Audit</button>
    </div>

    <div id="demo-box" class="card" style="margin-bottom:20px">
      <div class="card-h"><h3>Demo</h3></div>
      <div class="card-b"><pre id="demo-pre"></pre></div>
    </div>

    <div class="card" style="margin-bottom:20px">
      <div class="flow-bar">
        <span class="fn fn-a">Publish</span><span class="fa">&rarr;</span>
        <span class="fn fn-a">Discover</span><span class="fa">&rarr;</span>
        <span class="fn fn-ai">Negotiate</span><span class="fa">&rarr;</span>
        <span class="fn fn-p">Escrow</span><span class="fa">&rarr;</span>
        <span class="fn fn-a">Deliver</span><span class="fa">&rarr;</span>
        <span class="fn fn-ai">AI Validate</span><span class="fa">&rarr;</span>
        <span class="fn fn-p">Release</span>
        <span style="margin:0 8px;color:var(--text3)">|</span>
        <span class="fn fn-d">Dispute</span><span class="fa">&rarr;</span>
        <span class="fn fn-ai">Arbitrate</span><span class="fa">&rarr;</span>
        <span class="fn fn-p">Resolve</span>
      </div>
    </div>

    <div class="grid g73">
      <div class="card">
        <div class="card-h"><h3>Agent Chat</h3><span class="tag tag-p">AI</span></div>
        <div class="card-b">
          <div class="chat-row">
            <input id="ci" placeholder='e.g. "Publish an API for 0.50 USDT on polygon"' onkeydown="if(event.key==='Enter')chat()">
            <button class="btn btn-go" onclick="chat()">Send</button>
          </div>
          <div id="out">Try: "Check my balances" or "Find services under 5 USDT"</div>
        </div>
      </div>
      <div class="card">
        <div class="card-h"><h3>Activity</h3><span id="brain-tag" class="tag tag-r">Off</span></div>
        <div class="card-b scroll" id="feed"><div style="color:var(--text3);text-align:center;padding:16px;font-size:12px">Click Run Demo</div></div>
      </div>
    </div>

    <div class="grid g2">
      <div class="card">
        <div class="card-h"><h3>Publish Service</h3></div>
        <div class="card-b">
          <div class="fg"><label>Name</label><input id="sn" placeholder="Image Generation API"></div>
          <div class="fg"><label>Description</label><textarea id="sd" placeholder="Describe the service"></textarea></div>
          <div class="fr">
            <div class="fg"><label>Price (USDT)</label><input id="sp" type="number" step="0.01" placeholder="0.50"></div>
            <div class="fg"><label>Chain</label><select id="sc"><option>polygon</option><option>arbitrum</option><option>ethereum</option><option>sepolia</option></select></div>
          </div>
          <button class="btn btn-go" onclick="pub()">Publish</button>
        </div>
      </div>
      <div class="card">
        <div class="card-h"><h3>x402 APIs</h3><span class="tag tag-g">HTTP 402</span></div>
        <div class="card-b" id="x4">Loading...</div>
      </div>
    </div>
  </div>

  <script>
    const $=id=>document.getElementById(id);
    async function api(u){const d=await(await fetch(u)).json();$('out').textContent=JSON.stringify(d,null,2);}
    async function chat(){const i=$('ci'),m=i.value;if(!m)return;$('out').textContent='Thinking...';i.value='';const d=await(await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:m})})).json();$('out').textContent=d.response||JSON.stringify(d,null,2);rf();}
    async function pub(){const b={name:$('sn').value,description:$('sd').value,priceUsdt:$('sp').value,chain:$('sc').value};$('out').textContent=JSON.stringify(await(await fetch('/api/services',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)})).json(),null,2);rf();}
    async function rf(){try{const[e,s,x,l]=await Promise.all([fetch('/api/escrows').then(r=>r.json()),fetch('/api/services').then(r=>r.json()),fetch('/api/x402/services').then(r=>r.json()),fetch('/api/log').then(r=>r.json())]);$('s-esc').textContent=(e.totalEscrowed||'0.00')+' USDT';$('s-svc').textContent=s.services?.length||0;$('s-act').textContent=l.count||0;if(x.services)$('x4').innerHTML=x.services.map(s=>'<div class="row"><div><div class="row-t">'+s.description+'</div><div class="row-m">GET '+s.endpoint+'</div></div><div class="row-p">'+s.price+'</div></div>').join('');if(l.log?.length)$('feed').innerHTML=l.log.slice(-8).reverse().map(a=>'<div class="ev '+(a.type.includes('fail')?'ev-r':a.type.includes('decision')?'ev-p':'ev-g')+'"><b>'+a.type+'</b> '+a.description.substring(0,90)+'</div>').join('');}catch{}}
    let bp=null;
    async function toggleBrain(){const c=await(await fetch('/api/autonomous')).json();if(c.running){await fetch('/api/autonomous/stop',{method:'POST'});$('brain-tag').textContent='Off';$('brain-tag').className='tag tag-r';$('s-brain').textContent='off';$('s-brain').style.color='var(--red)';$('brainBtn').textContent='Start Brain';if(bp){clearInterval(bp);bp=null;}}else{await fetch('/api/autonomous/start',{method:'POST'});$('brain-tag').textContent='On';$('brain-tag').className='tag tag-g';$('s-brain').textContent='on';$('s-brain').style.color='var(--accent)';$('brainBtn').textContent='Stop Brain';bp=setInterval(rf,5000);}}
    async function runDemo(){const b=$('demoBtn');b.textContent='Running...';b.disabled=true;$('demo-box').classList.add('on');$('demo-pre').textContent='Running...';try{const d=await(await fetch('/api/demo',{method:'POST'})).then(r=>r.json());let o=d.status+'\\n\\n';if(d.steps)d.steps.forEach((s,i)=>{o+=(i+1)+'. '+s+'\\n';});if(d.summary)o+='\\n'+JSON.stringify(d.summary);$('demo-pre').textContent=o;rf();}catch(e){$('demo-pre').textContent='Error: '+e.message;}b.textContent='Run Demo';b.disabled=false;}
    rf();setInterval(rf,15000);
  </script>
</body>
</html>`;
}
