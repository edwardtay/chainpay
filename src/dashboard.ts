export function getDashboardHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ChainPay</title>
  <style>
    :root {
      --bg: #0d1117; --bg2: #161b22; --bg3: #1c2128; --border: #30363d;
      --text: #e6edf3; --text2: #8b949e; --text3: #6e7681;
      --blue: #58a6ff; --green: #3fb950; --red: #f85149; --orange: #d29922; --purple: #bc8cff;
    }
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; background: var(--bg); color: var(--text); font-size: 14px; }
    a { color: var(--blue); text-decoration: none; }

    .header { background: var(--bg2); border-bottom: 1px solid var(--border); padding: 20px 0; }
    .header-inner { max-width: 1280px; margin: 0 auto; padding: 0 24px; display: flex; align-items: center; justify-content: space-between; }
    .logo { font-size: 1.4em; font-weight: 700; color: var(--text); }
    .logo span { color: var(--green); }
    .header-tags { display: flex; gap: 6px; }
    .htag { padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 500; border: 1px solid var(--border); color: var(--text2); }
    .htag.active { border-color: var(--green); color: var(--green); }

    .container { max-width: 1280px; margin: 0 auto; padding: 20px 24px; }

    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
    .stat-card { background: var(--bg2); border: 1px solid var(--border); border-radius: 8px; padding: 16px; }
    .stat-card .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text2); margin-bottom: 4px; }
    .stat-card .value { font-size: 1.8em; font-weight: 700; color: var(--green); line-height: 1.2; }
    .stat-card .sub { font-size: 11px; color: var(--text3); margin-top: 2px; }

    .actions { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
    .btn { padding: 8px 16px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg2); color: var(--text); cursor: pointer; font-size: 13px; font-family: inherit; transition: all 0.15s; }
    .btn:hover { border-color: var(--blue); background: var(--bg3); }
    .btn-primary { background: #238636; border-color: #2ea043; color: #fff; }
    .btn-primary:hover { background: #2ea043; }
    .btn-sm { padding: 5px 12px; font-size: 12px; }

    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
    .grid3 { display: grid; grid-template-columns: 2fr 1fr; gap: 16px; margin-bottom: 20px; }

    .card { background: var(--bg2); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
    .card-header { padding: 12px 16px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
    .card-header h3 { font-size: 13px; font-weight: 600; color: var(--text2); text-transform: uppercase; letter-spacing: 0.5px; }
    .card-body { padding: 16px; }
    .card-body.scroll { max-height: 280px; overflow-y: auto; }

    .chat-box { display: flex; gap: 8px; }
    .chat-box input { flex: 1; padding: 10px 14px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg); color: var(--text); font-size: 13px; font-family: inherit; outline: none; }
    .chat-box input:focus { border-color: var(--blue); }
    #response { background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: 14px; margin-top: 12px; font-family: 'SF Mono', 'Fira Code', monospace; font-size: 12px; line-height: 1.5; white-space: pre-wrap; max-height: 300px; overflow-y: auto; color: var(--text2); }

    .flow { display: flex; align-items: center; justify-content: center; gap: 4px; flex-wrap: wrap; padding: 16px; }
    .flow-node { padding: 8px 14px; border-radius: 6px; font-size: 12px; font-weight: 500; }
    .flow-node.action { background: #1f6feb22; color: var(--blue); border: 1px solid #1f6feb44; }
    .flow-node.payment { background: #23863622; color: var(--green); border: 1px solid #23863644; }
    .flow-node.danger { background: #f8514922; color: var(--red); border: 1px solid #f8514944; }
    .flow-node.ai { background: #bc8cff22; color: var(--purple); border: 1px solid #bc8cff44; }
    .flow-arr { color: var(--text3); font-size: 16px; }

    .svc-item { padding: 10px 14px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
    .svc-item:last-child { border-bottom: none; }
    .svc-name { font-weight: 500; color: var(--text); }
    .svc-price { font-family: 'SF Mono', monospace; color: var(--green); font-size: 13px; }
    .svc-meta { font-size: 11px; color: var(--text3); }

    .event { padding: 8px 12px; border-left: 3px solid var(--border); margin-bottom: 6px; font-size: 12px; }
    .event .ev-type { color: var(--blue); font-weight: 600; font-size: 11px; text-transform: uppercase; }
    .event .ev-desc { color: var(--text2); margin-top: 2px; }
    .event .ev-ai { color: var(--orange); font-size: 11px; margin-top: 2px; }
    .event.ev-green { border-color: var(--green); }
    .event.ev-red { border-color: var(--red); }
    .event.ev-purple { border-color: var(--purple); }

    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
    .form-group { margin-bottom: 10px; }
    .form-group label { display: block; font-size: 11px; color: var(--text2); text-transform: uppercase; margin-bottom: 4px; }
    .form-group input, .form-group select, .form-group textarea { width: 100%; padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg); color: var(--text); font-size: 13px; font-family: inherit; }
    .form-group textarea { min-height: 50px; resize: vertical; }

    pre.api-ref { font-family: 'SF Mono', monospace; font-size: 11px; color: var(--text3); line-height: 1.6; }

    .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; }
    .badge-green { background: #23863633; color: var(--green); }
    .badge-red { background: #f8514933; color: var(--red); }

    #demo-output { display: none; }
    #demo-output.show { display: block; }
    #demo-results { font-family: 'SF Mono', monospace; font-size: 12px; color: var(--green); line-height: 1.6; }

    @media (max-width: 768px) { .stats { grid-template-columns: 1fr 1fr; } .grid2, .grid3 { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-inner">
      <div>
        <div class="logo">Chain<span>Pay</span></div>
        <div style="font-size:12px;color:var(--text3);margin-top:2px">Self-Custodial Agent Commerce Protocol</div>
      </div>
      <div class="header-tags">
        <span class="htag active">Tether WDK</span>
        <span class="htag">x402</span>
        <span class="htag">Claude AI</span>
        <span class="htag">9 Chains</span>
      </div>
    </div>
  </div>

  <div class="container">
    <!-- Stats -->
    <div class="stats">
      <div class="stat-card">
        <div class="label">Agent Status</div>
        <div class="value" style="color:var(--green)" id="stat-status">Online</div>
        <div class="sub">Autonomous brain: <span id="brain-status-mini" style="color:var(--red)">off</span></div>
      </div>
      <div class="stat-card">
        <div class="label">Total Escrowed</div>
        <div class="value" id="stat-escrowed">0.00</div>
        <div class="sub">USDT locked in escrows</div>
      </div>
      <div class="stat-card">
        <div class="label">Services</div>
        <div class="value" id="stat-services">0</div>
        <div class="sub">On marketplace</div>
      </div>
      <div class="stat-card">
        <div class="label">Agent Actions</div>
        <div class="value" id="stat-actions">0</div>
        <div class="sub">AI decisions made</div>
      </div>
    </div>

    <!-- Actions -->
    <div class="actions">
      <button class="btn btn-primary" onclick="runDemo()" id="demoBtn">Run Demo</button>
      <button class="btn" onclick="toggleBrain()" id="brainBtn">Start Brain</button>
      <button class="btn btn-sm" onclick="api('/api/addresses')">Addresses</button>
      <button class="btn btn-sm" onclick="api('/api/balances')">Balances</button>
      <button class="btn btn-sm" onclick="api('/api/services')">Services</button>
      <button class="btn btn-sm" onclick="api('/api/escrows')">Escrows</button>
      <button class="btn btn-sm" onclick="api('/api/negotiations')">Negotiations</button>
      <button class="btn btn-sm" onclick="api('/api/disputes')">Disputes</button>
      <button class="btn btn-sm" onclick="api('/api/subscriptions')">Subscriptions</button>
      <button class="btn btn-sm" onclick="api('/api/autonomous')">Brain Status</button>
      <button class="btn btn-sm" onclick="window.open('/api/audit')">Audit Trail</button>
    </div>

    <!-- Demo output -->
    <div id="demo-output" class="card" style="margin-bottom:20px">
      <div class="card-header"><h3>Demo Scenario</h3></div>
      <div class="card-body"><pre id="demo-results"></pre></div>
    </div>

    <!-- Flow diagram -->
    <div class="card" style="margin-bottom:20px">
      <div class="card-header"><h3>Agent Commerce Flow</h3></div>
      <div class="flow">
        <span class="flow-node action">Publish</span><span class="flow-arr">&rarr;</span>
        <span class="flow-node action">Discover</span><span class="flow-arr">&rarr;</span>
        <span class="flow-node ai">Negotiate</span><span class="flow-arr">&rarr;</span>
        <span class="flow-node payment">Escrow</span><span class="flow-arr">&rarr;</span>
        <span class="flow-node action">Deliver</span><span class="flow-arr">&rarr;</span>
        <span class="flow-node ai">AI Validate</span><span class="flow-arr">&rarr;</span>
        <span class="flow-node payment">Release</span>
      </div>
      <div class="flow" style="padding-top:0">
        <span style="color:var(--text3);font-size:12px">If rejected:</span>
        <span class="flow-node danger">Dispute</span><span class="flow-arr">&rarr;</span>
        <span class="flow-node ai">AI Arbitrate</span><span class="flow-arr">&rarr;</span>
        <span class="flow-node payment">Resolve</span>
      </div>
    </div>

    <!-- Main grid -->
    <div class="grid3">
      <!-- Chat -->
      <div class="card">
        <div class="card-header">
          <h3>Agent Chat</h3>
          <span class="badge badge-green">AI-Powered</span>
        </div>
        <div class="card-body">
          <div class="chat-box">
            <input type="text" id="chatInput" placeholder='Try: "Publish an API service for 0.50 USDT on polygon"' onkeydown="if(event.key==='Enter')sendChat()" />
            <button class="btn btn-primary" onclick="sendChat()">Send</button>
          </div>
          <div id="response">Ready. Try:
  "Publish a data analysis service for 2 USDT on polygon"
  "Find services under 5 USDT"
  "Check my balances"
  "Show active escrows"
  "Optimize my idle funds"</div>
        </div>
      </div>

      <!-- Activity feed -->
      <div class="card">
        <div class="card-header">
          <h3>Activity</h3>
          <span id="brain-status" class="badge badge-red">Brain Off</span>
        </div>
        <div class="card-body scroll" id="activity-feed">
          <div style="color:var(--text3);font-size:12px;text-align:center;padding:20px">
            Click "Run Demo" or "Start Brain" to see activity
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom grid -->
    <div class="grid2">
      <!-- Publish service -->
      <div class="card">
        <div class="card-header"><h3>Publish Service</h3></div>
        <div class="card-body">
          <div class="form-group">
            <label>Service Name</label>
            <input id="svcName" placeholder="Image Generation API" />
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea id="svcDesc" placeholder="Generate images from text prompts"></textarea>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Price (USDT)</label><input id="svcPrice" type="number" step="0.01" placeholder="0.50" /></div>
            <div class="form-group"><label>Chain</label><select id="svcChain"><option value="polygon">Polygon</option><option value="arbitrum">Arbitrum</option><option value="ethereum">Ethereum</option><option value="sepolia">Sepolia</option></select></div>
          </div>
          <button class="btn btn-primary" onclick="publishService()">Publish</button>
        </div>
      </div>

      <!-- x402 Services -->
      <div class="card">
        <div class="card-header">
          <h3>x402 Pay-Per-Use APIs</h3>
          <span class="badge badge-green">HTTP 402</span>
        </div>
        <div class="card-body" id="x402-services">Loading...</div>
      </div>
    </div>
  </div>

  <script>
    async function api(url) {
      const r = await fetch(url); const d = await r.json();
      document.getElementById('response').textContent = JSON.stringify(d, null, 2);
    }
    async function sendChat() {
      const input = document.getElementById('chatInput');
      const msg = input.value; if (!msg) return;
      document.getElementById('response').textContent = 'Thinking...';
      input.value = '';
      const r = await fetch('/api/chat', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({message:msg}) });
      const d = await r.json();
      document.getElementById('response').textContent = d.response || JSON.stringify(d, null, 2);
      refreshStats();
    }
    async function publishService() {
      const body = { name: document.getElementById('svcName').value, description: document.getElementById('svcDesc').value, priceUsdt: document.getElementById('svcPrice').value, chain: document.getElementById('svcChain').value };
      const r = await fetch('/api/services', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
      document.getElementById('response').textContent = JSON.stringify(await r.json(), null, 2);
      refreshStats();
    }
    async function refreshStats() {
      try {
        const [e, s, x, l] = await Promise.all([
          fetch('/api/escrows').then(r=>r.json()),
          fetch('/api/services').then(r=>r.json()),
          fetch('/api/x402/services').then(r=>r.json()),
          fetch('/api/log').then(r=>r.json()),
        ]);
        document.getElementById('stat-escrowed').textContent = (e.totalEscrowed||'0.00')+' USDT';
        document.getElementById('stat-services').textContent = (s.services?.length||0);
        document.getElementById('stat-actions').textContent = l.count||0;
        const x4 = document.getElementById('x402-services');
        if (x.services) x4.innerHTML = x.services.map(s=>'<div class="svc-item"><div><div class="svc-name">'+s.description+'</div><div class="svc-meta">GET '+s.endpoint+'</div></div><div class="svc-price">'+s.price+'</div></div>').join('');
        // Activity feed
        if (l.log?.length) {
          document.getElementById('activity-feed').innerHTML = l.log.slice(-10).reverse().map(a=>{
            const cls = a.type.includes('fail')||a.type.includes('error')?'ev-red':a.type.includes('ai')||a.type.includes('decision')?'ev-purple':'ev-green';
            return '<div class="event '+cls+'"><div class="ev-type">'+a.type+'</div><div class="ev-desc">'+a.description.substring(0,100)+'</div>'+(a.aiReasoning?'<div class="ev-ai">AI: '+a.aiReasoning.substring(0,80)+'</div>':'')+'</div>';
          }).join('');
        }
      } catch {}
    }
    let brainPoll=null;
    async function toggleBrain(){
      const b=document.getElementById('brainBtn'),s=document.getElementById('brain-status'),sm=document.getElementById('brain-status-mini');
      const c=await fetch('/api/autonomous').then(r=>r.json());
      if(c.running){
        await fetch('/api/autonomous/stop',{method:'POST'});
        s.textContent='Brain Off';s.className='badge badge-red';sm.textContent='off';sm.style.color='var(--red)';b.textContent='Start Brain';
        if(brainPoll){clearInterval(brainPoll);brainPoll=null;}
      } else {
        await fetch('/api/autonomous/start',{method:'POST'});
        s.textContent='Brain On';s.className='badge badge-green';sm.textContent='on';sm.style.color='var(--green)';b.textContent='Stop Brain';
        brainPoll=setInterval(refreshStats,5000);
      }
    }
    async function runDemo(){
      const b=document.getElementById('demoBtn');b.textContent='Running...';b.disabled=true;
      const o=document.getElementById('demo-output');o.classList.add('show');
      document.getElementById('demo-results').textContent='Executing agent commerce scenario...';
      try{
        const d=await fetch('/api/demo',{method:'POST'}).then(r=>r.json());
        let out=d.status+'\\n\\n';
        if(d.steps) d.steps.forEach((s,i)=>{out+=(i+1)+'. '+s+'\\n';});
        if(d.summary) out+='\\nServices: '+d.summary.services+' | Escrows: '+d.summary.escrowsCompleted+' | Subs: '+d.summary.subscriptionsActive;
        document.getElementById('demo-results').textContent=out;
        refreshStats();
      }catch(e){document.getElementById('demo-results').textContent='Error: '+e.message;}
      b.textContent='Run Demo';b.disabled=false;
    }
    refreshStats();
    setInterval(refreshStats,15000);
  </script>
</body>
</html>`;
}
