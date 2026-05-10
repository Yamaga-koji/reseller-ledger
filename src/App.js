import { useState, useEffect, useRef, useMemo } from "react";

const SUPABASE_URL = "https://cyxzbdquadnioexrpnsf.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5eHpiZHF1YWRuaW9leHJwbnNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzODA4MDIsImV4cCI6MjA5Mzk1NjgwMn0.6ToWcm5pW1XMh7dGyssU9G8XML2AvWEDjsmua9REWuY";

const H = {
  "Content-Type": "application/json",
  "apikey": SUPABASE_KEY,
  "Authorization": "Bearer " + SUPABASE_KEY,
  "Prefer": "return=representation",
};

async function dbGet(table) {
  try {
    const res = await fetch(SUPABASE_URL + "/rest/v1/" + table + "?order=created_at.desc", { headers: H });
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

async function dbInsert(table, row) {
  try {
    const res = await fetch(SUPABASE_URL + "/rest/v1/" + table, {
      method: "POST", headers: H, body: JSON.stringify(row),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) ? data[0] : data;
  } catch { return null; }
}

async function dbDelete(table, id) {
  try { await fetch(SUPABASE_URL + "/rest/v1/" + table + "?id=eq." + id, { method: "DELETE", headers: H }); } catch {}
}

async function dbUpdate(table, id, patch) {
  try {
    await fetch(SUPABASE_URL + "/rest/v1/" + table + "?id=eq." + id, {
      method: "PATCH", headers: H, body: JSON.stringify(patch),
    });
  } catch {}
}

const TAX_RATE = 0.25;
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const now = new Date();
const THIS_YEAR = now.getFullYear();
const THIS_MONTH = now.getMonth();
const monthKey = (y, m) => y + "-" + String(m+1).padStart(2,"0");
const fmt = (n) => "$" + Number(n||0).toFixed(2);

const TABS = [
  {id:"dashboard",label:"📊 总览"},
  {id:"income",label:"💰 收入"},
  {id:"purchase",label:"📦 收货"},
  {id:"inventory",label:"🏷️ 库存"},
  {id:"expenses",label:"💸 支出"},
  {id:"tax",label:"🗽 税务"},
];

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [selYear, setSelYear] = useState(THIS_YEAR);
  const [selMonth, setSelMonth] = useState(THIS_MONTH);
  const [loading, setLoading] = useState(true);
  const [incomes, setIncomes] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [expenses, setExpenses] = useState([]);

  useEffect(() => {
    Promise.all([dbGet("incomes"),dbGet("purchases"),dbGet("inventory"),dbGet("expenses")])
      .then(([a,b,c,d]) => { setIncomes(a||[]); setPurchases(b||[]); setInventory(c||[]); setExpenses(d||[]); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const mk = monthKey(selYear, selMonth);
  const mInc = incomes.filter(i=>i.month===mk);
  const mPur = purchases.filter(p=>p.month===mk);
  const mExp = expenses.filter(e=>e.month===mk);
  const tInc = mInc.reduce((s,i)=>s+(i.amount||0),0);
  const tPur = mPur.reduce((s,p)=>s+(p.total_cost||0),0);
  const tExp = mExp.reduce((s,e)=>s+(e.amount||0),0);
  const gross = tInc-tPur-tExp;
  const tax = Math.max(0,gross)*TAX_RATE;
  const net = gross-tax;

  const p = {mk,selYear,selMonth,setSelYear,setSelMonth,incomes,setIncomes,purchases,setPurchases,inventory,setInventory,expenses,setExpenses,mInc,mPur,mExp,tInc,tPur,tExp,gross,tax,net};

  if (loading) return <div className="app"><Style/><div className="loading"><div className="spinner"/><p>连接云端数据库…</p></div></div>;

  return (
    <div className="app">
      <Style/>
      <header className="header">
        <div className="header-top">
          <div className="logo">RESELLER<span>LEDGER</span></div>
          <div className="cloud-badge">☁️ 云端同步</div>
          <div className="month-picker">
            <select value={selYear} onChange={e=>setSelYear(+e.target.value)}>
              {[THIS_YEAR-1,THIS_YEAR,THIS_YEAR+1].map(y=><option key={y}>{y}</option>)}
            </select>
            <select value={selMonth} onChange={e=>setSelMonth(+e.target.value)}>
              {MONTHS.map((m,i)=><option key={m} value={i}>{m}</option>)}
            </select>
          </div>
        </div>
        <nav className="tabs">
          {TABS.map(t=><button key={t.id} className={"tab"+(tab===t.id?" active":"")} onClick={()=>setTab(t.id)}>{t.label}</button>)}
        </nav>
      </header>
      <main className="main">
        {tab==="dashboard" && <Dashboard {...p}/>}
        {tab==="income" && <Income {...p}/>}
        {tab==="purchase" && <Purchase {...p}/>}
        {tab==="inventory" && <Inventory {...p}/>}
        {tab==="expenses" && <Expenses {...p}/>}
        {tab==="tax" && <Tax selYear={selYear} incomes={incomes} expenses={expenses} purchases={purchases}/>}
      </main>
    </div>
  );
}

function Dashboard({selYear,selMonth,tInc,tPur,tExp,gross,tax,net,mInc,inventory}) {
  const ebay=mInc.filter(i=>i.platform==="eBay").reduce((s,i)=>s+i.amount,0);
  const mercari=mInc.filter(i=>i.platform==="Mercari").reduce((s,i)=>s+i.amount,0);
  const other=mInc.filter(i=>i.platform==="Other").reduce((s,i)=>s+i.amount,0);
  const inStock=inventory.filter(i=>i.status==="In Stock");
  const invVal=inStock.reduce((s,i)=>s+(i.cost_price||0)*(i.qty||1),0);
  const invCnt=inStock.reduce((s,i)=>s+(i.qty||1),0);
  const cards=[
    {label:"总收入",val:fmt(tInc),color:"green",sub:"eBay "+fmt(ebay)+" · Mercari "+fmt(mercari)},
    {label:"收货成本",val:fmt(tPur),color:"orange",sub:"本月采购支出"},
    {label:"其他支出",val:fmt(tExp),color:"red",sub:"运营费用合计"},
    {label:"毛利润",val:fmt(gross),color:gross>=0?"blue":"red",sub:"收入 − 成本 − 支出"},
    {label:"预留税款",val:fmt(tax),color:"yellow",sub:"按 "+(TAX_RATE*100).toFixed(0)+"% 预留"},
    {label:"税后净利",val:fmt(net),color:net>=0?"teal":"red",sub:"到手收入"},
  ];
  return (
    <section>
      <p className="period-label">{MONTHS[selMonth]} {selYear} 月度概览</p>
      <div className="stat-grid">
        {cards.map(c=><div key={c.label} className={"stat-card c-"+c.color}><span className="stat-label">{c.label}</span><strong className="stat-val">{c.val}</strong><small className="stat-sub">{c.sub}</small></div>)}
      </div>
      <div className="row-2col">
        <div className="card">
          <h3 className="card-title">平台收入拆分</h3>
          {[["eBay",ebay,"#f0b429"],["Mercari",mercari,"#3fb950"],["其他",other,"#58a6ff"]].map(([l,a,c])=>(
            <div key={l} className="platform-row">
              <span className="plat-label">{l}</span>
              <div className="bar-wrap"><div className="bar-fill" style={{width:(tInc>0?a/tInc*100:0)+"%",background:c}}/></div>
              <span className="plat-amt">{fmt(a)}</span>
            </div>
          ))}
        </div>
        <div className="card">
          <h3 className="card-title">在库库存</h3>
          <div className="inv-summary">
            <div><span>在库件数</span><strong>{invCnt} 件</strong></div>
            <div><span>在库成本</span><strong>{fmt(invVal)}</strong></div>
          </div>
          {inStock.slice(0,4).map(i=><div key={i.id} className="inv-row"><span className="sku-badge">{i.sku||"—"}</span><span className="inv-name">{i.name}</span><span className="inv-qty">×{i.qty||1}</span></div>)}
          {inStock.length>4&&<p className="muted-sm">还有 {inStock.length-4} 件…</p>}
        </div>
      </div>
    </section>
  );
}

function Income({mk,mInc,setIncomes}) {
  const blank={platform:"eBay",amount:"",order_no:"",note:"",date:""};
  const [form,setForm]=useState(blank);
  const [saving,setSaving]=useState(false);
  const set=k=>e=>setForm(f=>({...f,[k]:e.target.value}));
  const add=async()=>{
    if(!form.amount) return;
    setSaving(true);
    const row={month:mk,platform:form.platform,amount:parseFloat(form.amount),order_no:form.order_no,note:form.note,date:form.date||new Date().toLocaleDateString("en-US")};
    const saved=await dbInsert("incomes",row);
    setIncomes(p=>[saved||row,...p]);
    setForm(blank); setSaving(false);
  };
  const del=async id=>{await dbDelete("incomes",id); setIncomes(p=>p.filter(x=>x.id!==id));};
  return (
    <section>
      <div className="card">
        <h2 className="card-title">➕ 添加收入记录</h2>
        <div className="form-grid">
          <label>平台<select value={form.platform} onChange={set("platform")}><option>eBay</option><option>Mercari</option><option>Other</option></select></label>
          <label>金额 ($)<input type="number" value={form.amount} onChange={set("amount")} placeholder="0.00" min="0"/></label>
          <label>订单号<input value={form.order_no} onChange={set("order_no")} placeholder="可选"/></label>
          <label>日期<input type="date" value={form.date} onChange={set("date")}/></label>
          <label className="span2">备注<input value={form.note} onChange={set("note")} placeholder="商品描述…"/></label>
        </div>
        <button className="btn-primary" onClick={add} disabled={saving}>{saving?"保存中…":"添加收入"}</button>
      </div>
      <div className="card">
        <h2 className="card-title">本月收入明细</h2>
        {mInc.length===0?<p className="empty">暂无记录</p>:(
          <table className="tbl">
            <thead><tr><th>平台</th><th>日期</th><th>金额</th><th>订单号</th><th>备注</th><th></th></tr></thead>
            <tbody>{mInc.map(i=><tr key={i.id}><td><span className={"plat-tag "+i.platform?.toLowerCase()}>{i.platform}</span></td><td>{i.date}</td><td className="green">{fmt(i.amount)}</td><td className="mono">{i.order_no||"—"}</td><td>{i.note||"—"}</td><td><button className="del" onClick={()=>del(i.id)}>✕</button></td></tr>)}</tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function Purchase({mk,mPur,setPurchases,setInventory}) {
  const blank={name:"",sku:"",buy_price:"",shipping:"",other:"",qty:"1",note:"",date:"",image:null};
  const [form,setForm]=useState(blank);
  const [saving,setSaving]=useState(false);
  const set=k=>e=>setForm(f=>({...f,[k]:e.target.value}));
  const imgRef=useRef();
  const qty=parseInt(form.qty)||1;
  const totalCost=useMemo(()=>(parseFloat(form.buy_price)||0)*qty+(parseFloat(form.shipping)||0)+(parseFloat(form.other)||0),[form,qty]);
  const unitCost=totalCost/qty;
  const handleImg=e=>{const file=e.target.files[0];if(!file)return;const r=new FileReader();r.onload=ev=>setForm(f=>({...f,image:ev.target.result}));r.readAsDataURL(file);};
  const add=async()=>{
    if(!form.name||!form.buy_price) return;
    setSaving(true);
    const prow={month:mk,name:form.name,sku:form.sku,buy_price:parseFloat(form.buy_price),shipping:parseFloat(form.shipping)||0,other:parseFloat(form.other)||0,qty,total_cost:totalCost,unit_cost:unitCost,note:form.note,image:form.image,date:form.date||new Date().toLocaleDateString("en-US")};
    const irow={sku:form.sku,name:form.name,cost_price:unitCost,qty,status:"In Stock",note:form.note,image:form.image,added_month:mk};
    const [sp,si]=await Promise.all([dbInsert("purchases",prow),dbInsert("inventory",irow)]);
    setPurchases(p=>[sp||prow,...p]);
    setInventory(inv=>[si||irow,...inv]);
    setForm(blank); setSaving(false);
  };
  const del=async id=>{await dbDelete("purchases",id);setPurchases(p=>p.filter(x=>x.id!==id));};
  return (
    <section>
      <div className="card">
        <h2 className="card-title">➕ 添加收货记录</h2>
        <div className="form-grid">
          <label>商品名称<input value={form.name} onChange={set("name")} placeholder="例：Jordan 1 Retro"/></label>
          <label>SKU / 编号<input value={form.sku} onChange={set("sku")} placeholder="例：JD1-001"/></label>
          <label>收购单价 ($)<input type="number" value={form.buy_price} onChange={set("buy_price")} placeholder="0.00" min="0"/></label>
          <label>运费 ($)<input type="number" value={form.shipping} onChange={set("shipping")} placeholder="0.00" min="0"/></label>
          <label>其他费用 ($)<input type="number" value={form.other} onChange={set("other")} placeholder="关税、包装" min="0"/></label>
          <label>数量<input type="number" value={form.qty} onChange={set("qty")} placeholder="1" min="1"/></label>
          <label>日期<input type="date" value={form.date} onChange={set("date")}/></label>
          <label>备注<input value={form.note} onChange={set("note")} placeholder="来源、状况…"/></label>
          <label className="span2">商品图片
            <div className="img-upload" onClick={()=>imgRef.current.click()}>
              {form.image?<img src={form.image} alt="" className="img-preview"/>:<span>📷 点击上传图片</span>}
            </div>
            <input ref={imgRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleImg}/>
          </label>
        </div>
        <div className="cost-summary">
          <div><span>单件成本</span><strong>{fmt(unitCost)}</strong></div>
          <div><span>总成本</span><strong>{fmt(totalCost)}</strong></div>
        </div>
        <button className="btn-primary" onClick={add} disabled={saving}>{saving?"保存中…":"添加收货（自动入库）"}</button>
      </div>
      <div className="card">
        <h2 className="card-title">本月收货明细</h2>
        {mPur.length===0?<p className="empty">暂无记录</p>:(
          <div className="purchase-list">
            {mPur.map(p=>(
              <div key={p.id} className="purchase-item">
                {p.image&&<img src={p.image} alt="" className="thumb"/>}
                <div className="purchase-info">
                  <div className="purchase-name">{p.name}{p.sku&&<span className="sku-badge">{p.sku}</span>}</div>
                  <div className="purchase-meta">数量 {p.qty} · 单件 {fmt(p.unit_cost)} · <strong>总计 {fmt(p.total_cost)}</strong></div>
                  {p.note&&<div className="purchase-note">{p.note}</div>}
                </div>
                <button className="del" onClick={()=>del(p.id)}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Inventory({inventory,setInventory}) {
  const [filter,setFilter]=useState("All");
  const [search,setSearch]=useState("");
  const [editId,setEditId]=useState(null);
  const [editNote,setEditNote]=useState("");
  const imgRef=useRef();
  const [imgTarget,setImgTarget]=useState(null);
  const filtered=inventory.filter(i=>(filter==="All"||i.status===filter)&&(!search||i.name?.toLowerCase().includes(search.toLowerCase())||i.sku?.toLowerCase().includes(search.toLowerCase())));
  const updStatus=async(id,status)=>{await dbUpdate("inventory",id,{status});setInventory(inv=>inv.map(i=>i.id===id?{...i,status}:i));};
  const updNote=async(id,note)=>{await dbUpdate("inventory",id,{note});setInventory(inv=>inv.map(i=>i.id===id?{...i,note}:i));};
  const updImg=async(id,image)=>{await dbUpdate("inventory",id,{image});setInventory(inv=>inv.map(i=>i.id===id?{...i,image}:i));};
  const del=async id=>{await dbDelete("inventory",id);setInventory(inv=>inv.filter(i=>i.id!==id));};
  const handleImg=e=>{const file=e.target.files[0];if(!file||!imgTarget)return;const r=new FileReader();r.onload=ev=>{updImg(imgTarget,ev.target.result);setImgTarget(null);};r.readAsDataURL(file);};
  const sc={"In Stock":"green","Listed":"blue","Sold":"muted","Returned":"orange"};
  return (
    <section>
      <div className="card">
        <div className="inv-controls">
          <input className="search-input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 搜索商品名 / SKU"/>
          <div className="filter-tabs">
            {["All","In Stock","Listed","Sold","Returned"].map(s=><button key={s} className={"ftab"+(filter===s?" active":"")} onClick={()=>setFilter(s)}>{s}</button>)}
          </div>
        </div>
        {filtered.length===0?<p className="empty">暂无记录</p>:(
          <div className="inv-grid">
            {filtered.map(item=>(
              <div key={item.id} className="inv-card">
                <div className="inv-img-wrap" onClick={()=>{setImgTarget(item.id);imgRef.current.click();}}>
                  {item.image?<img src={item.image} alt="" className="inv-img"/>:<div className="inv-img-placeholder">📷</div>}
                  <div className="img-overlay">换图</div>
                </div>
                <div className="inv-body">
                  {item.sku&&<span className="sku-badge">{item.sku}</span>}
                  <div className="inv-item-name">{item.name}</div>
                  <div className="inv-item-meta">成本 {fmt(item.cost_price)} · ×{item.qty||1}</div>
                  <select className={"status-select s-"+(sc[item.status]||"muted")} value={item.status} onChange={e=>updStatus(item.id,e.target.value)}>
                    {["In Stock","Listed","Sold","Returned"].map(s=><option key={s}>{s}</option>)}
                  </select>
                  {editId===item.id
                    ?<input autoFocus value={editNote} onChange={e=>setEditNote(e.target.value)} onBlur={()=>{updNote(item.id,editNote);setEditId(null);}} onKeyDown={e=>{if(e.key==="Enter"){updNote(item.id,editNote);setEditId(null);}}} placeholder="备注…" style={{fontSize:".78rem",padding:"5px 8px"}}/>
                    :<div className="inv-note" onClick={()=>{setEditId(item.id);setEditNote(item.note||"");}}>{item.note||<span className="muted-sm">+ 添加备注</span>}</div>
                  }
                </div>
                <button className="del abs" onClick={()=>del(item.id)}>✕</button>
              </div>
            ))}
          </div>
        )}
        <input ref={imgRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleImg}/>
      </div>
      <AddInvManual setInventory={setInventory}/>
    </section>
  );
}

function AddInvManual({setInventory}) {
  const blank={name:"",sku:"",cost_price:"",qty:"1",status:"In Stock",note:"",image:null};
  const [form,setForm]=useState(blank);
  const [open,setOpen]=useState(false);
  const [saving,setSaving]=useState(false);
  const set=k=>e=>setForm(f=>({...f,[k]:e.target.value}));
  const imgRef=useRef();
  const handleImg=e=>{const file=e.target.files[0];if(!file)return;const r=new FileReader();r.onload=ev=>setForm(f=>({...f,image:ev.target.result}));r.readAsDataURL(file);};
  const add=async()=>{
    if(!form.name) return;
    setSaving(true);
    const row={name:form.name,sku:form.sku,cost_price:parseFloat(form.cost_price)||0,qty:parseInt(form.qty)||1,status:form.status,note:form.note,image:form.image};
    const saved=await dbInsert("inventory",row);
    setInventory(inv=>[saved||row,...inv]);
    setForm(blank); setOpen(false); setSaving(false);
  };
  return (
    <div className="card">
      <button className="btn-ghost" onClick={()=>setOpen(o=>!o)}>{open?"▲ 收起":"➕ 手动添加库存"}</button>
      {open&&<>
        <div className="form-grid" style={{marginTop:16}}>
          <label>商品名称<input value={form.name} onChange={set("name")} placeholder="商品名"/></label>
          <label>SKU<input value={form.sku} onChange={set("sku")} placeholder="SKU / 编号"/></label>
          <label>成本价 ($)<input type="number" value={form.cost_price} onChange={set("cost_price")} placeholder="0.00"/></label>
          <label>数量<input type="number" value={form.qty} onChange={set("qty")} placeholder="1"/></label>
          <label>状态<select value={form.status} onChange={set("status")}>{["In Stock","Listed","Sold","Returned"].map(s=><option key={s}>{s}</option>)}</select></label>
          <label>备注<input value={form.note} onChange={set("note")} placeholder="可选"/></label>
          <label className="span2">图片
            <div className="img-upload" onClick={()=>imgRef.current.click()}>
              {form.image?<img src={form.image} alt="" className="img-preview"/>:<span>📷 点击上传</span>}
            </div>
            <input ref={imgRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleImg}/>
          </label>
        </div>
        <button className="btn-primary" onClick={add} disabled={saving}>{saving?"保存中…":"添加到库存"}</button>
      </>}
    </div>
  );
}

function Expenses({mk,mExp,setExpenses}) {
  const blank={label:"",amount:"",category:"运营",date:"",note:""};
  const [form,setForm]=useState(blank);
  const [saving,setSaving]=useState(false);
  const set=k=>e=>setForm(f=>({...f,[k]:e.target.value}));
  const CATS=["运营","运费","仓储","广告","工具订阅","其他"];
  const add=async()=>{
    if(!form.label||!form.amount) return;
    setSaving(true);
    const row={month:mk,label:form.label,amount:parseFloat(form.amount),category:form.category,note:form.note,date:form.date||new Date().toLocaleDateString("en-US")};
    const saved=await dbInsert("expenses",row);
    setExpenses(p=>[saved||row,...p]);
    setForm(blank); setSaving(false);
  };
  const del=async id=>{await dbDelete("expenses",id);setExpenses(p=>p.filter(x=>x.id!==id));};
  return (
    <section>
      <div className="card">
        <h2 className="card-title">➕ 添加支出</h2>
        <div className="form-grid">
          <label>支出项目<input value={form.label} onChange={set("label")} placeholder="例：eBay Promoted Listings"/></label>
          <label>金额 ($)<input type="number" value={form.amount} onChange={set("amount")} placeholder="0.00" min="0"/></label>
          <label>类别<select value={form.category} onChange={set("category")}>{CATS.map(c=><option key={c}>{c}</option>)}</select></label>
          <label>日期<input type="date" value={form.date} onChange={set("date")}/></label>
          <label className="span2">备注<input value={form.note} onChange={set("note")} placeholder="可选"/></label>
        </div>
        <button className="btn-primary" onClick={add} disabled={saving}>{saving?"保存中…":"添加支出"}</button>
      </div>
      <div className="card">
        <h2 className="card-title">本月支出明细</h2>
        {mExp.length===0?<p className="empty">暂无记录</p>:(
          <table className="tbl">
            <thead><tr><th>项目</th><th>类别</th><th>日期</th><th>金额</th><th>备注</th><th></th></tr></thead>
            <tbody>{mExp.map(e=><tr key={e.id}><td>{e.label}</td><td><span className="cat-badge">{e.category}</span></td><td>{e.date}</td><td className="red">{fmt(e.amount)}</td><td>{e.note||"—"}</td><td><button className="del" onClick={()=>del(e.id)}>✕</button></td></tr>)}</tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function Tax({selYear,incomes,expenses,purchases}) {
  const yi=incomes.filter(i=>i.month?.startsWith(selYear)).reduce((s,i)=>s+i.amount,0);
  const yp=purchases.filter(p=>p.month?.startsWith(selYear)).reduce((s,p)=>s+(p.total_cost||0),0);
  const ye=expenses.filter(e=>e.month?.startsWith(selYear)).reduce((s,e)=>s+e.amount,0);
  const yp2=yi-yp-ye;
  const se=Math.max(0,yp2)*0.153;
  const fed=Math.max(0,yp2-se/2)*0.22;
  const ny=Math.max(0,yp2)*0.0685;
  const nyc=Math.max(0,yp2)*0.03876;
  const total=se+fed+ny+nyc;
  const rows=[
    {label:"年度总收入",val:fmt(yi),note:"eBay + Mercari + 其他"},
    {label:"年度收货成本 (COGS)",val:fmt(yp),note:"可抵税"},
    {label:"年度运营支出",val:fmt(ye),note:"可抵税"},
    {label:"净利润 (应税收入)",val:fmt(yp2),note:"Schedule C 利润"},
    {label:"自雇税 SE Tax 15.3%",val:fmt(se),note:"社保 + 医保"},
    {label:"联邦所得税 ~22%",val:fmt(fed),note:"估算"},
    {label:"NY 州税 6.85%",val:fmt(ny),note:"New York State"},
    {label:"NYC 市税 3.876%",val:fmt(nyc),note:"New York City"},
  ];
  return (
    <section>
      <div className="card tax-disclaimer"><p>⚠️ 以下为 <strong>{selYear} 年度</strong>税款估算，仅供参考，请咨询专业 CPA。</p></div>
      <div className="card">
        <h2 className="card-title">🗽 纽约 1099 税务估算</h2>
        <table className="tbl">
          <tbody>{rows.map(r=><tr key={r.label}><td>{r.label}</td><td className="mono">{r.val}</td><td className="muted-sm">{r.note}</td></tr>)}</tbody>
          <tfoot><tr><td><strong>预计总税款</strong></td><td className="red mono">{fmt(total)}</td><td></td></tr></tfoot>
        </table>
      </div>
      <div className="card">
        <h2 className="card-title">📅 季度预缴税</h2>
        <p className="hint-text">每季度大约需要预缴：</p>
        <div className="qtr-big">{fmt(total/4)}<span>/季度</span></div>
        <div className="qtr-dates">
          {[["Q1","Apr 15"],["Q2","Jun 17"],["Q3","Sep 16"],["Q4","Jan 15"]].map(([q,d])=><div key={q}><strong>{q}</strong>{d}</div>)}
        </div>
      </div>
    </section>
  );
}

function Style() {
  return <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Mono:wght@400;500&family=Noto+Sans+SC:wght@400;500;700&display=swap');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    :root{--bg:#0a0c0f;--s1:#111418;--s2:#1a1f27;--border:#252b35;--text:#e8edf5;--muted:#6b7585;--accent:#f0b429;--green:#3fb950;--red:#f85149;--blue:#58a6ff;--orange:#e3873a;--teal:#39d353;--yellow:#f0b429}
    body{background:var(--bg);color:var(--text);font-family:'Noto Sans SC',sans-serif;min-height:100vh}
    .app{display:flex;flex-direction:column;min-height:100vh}
    .loading{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:16px;color:var(--muted)}
    .spinner{width:36px;height:36px;border:3px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin .8s linear infinite}
    @keyframes spin{to{transform:rotate(360deg)}}
    .header{background:var(--s1);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:100}
    .header-top{display:flex;align-items:center;gap:10px;padding:16px 20px 0;flex-wrap:wrap}
    .logo{font-family:'Syne',sans-serif;font-size:1.2rem;font-weight:800;letter-spacing:2px;color:var(--accent);margin-right:auto}
    .logo span{color:var(--text);opacity:.5}
    .cloud-badge{background:rgba(63,185,80,.1);border:1px solid rgba(63,185,80,.3);color:var(--green);border-radius:20px;padding:3px 10px;font-size:.72rem}
    .month-picker{display:flex;gap:8px}
    .month-picker select{background:var(--s2);border:1px solid var(--border);border-radius:8px;color:var(--text);padding:6px 10px;font-size:.82rem;outline:none;cursor:pointer}
    .tabs{display:flex;overflow-x:auto;padding:0 16px;gap:2px;scrollbar-width:none}
    .tabs::-webkit-scrollbar{display:none}
    .tab{background:transparent;border:none;border-bottom:3px solid transparent;color:var(--muted);cursor:pointer;padding:10px 14px;font-family:'Noto Sans SC',sans-serif;font-size:.85rem;white-space:nowrap;transition:all .2s}
    .tab.active{color:var(--accent);border-bottom-color:var(--accent)}
    .tab:hover:not(.active){color:var(--text)}
    .main{padding:20px 16px 60px;max-width:860px;margin:0 auto;width:100%}
    .period-label{font-family:'DM Mono',monospace;font-size:.8rem;color:var(--muted);margin-bottom:14px;text-transform:uppercase;letter-spacing:1px}
    .card{background:var(--s1);border:1px solid var(--border);border-radius:14px;padding:22px;margin-bottom:18px}
    .card-title{font-family:'Syne',sans-serif;font-size:1rem;font-weight:700;margin-bottom:16px}
    .stat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:18px}
    @media(max-width:600px){.stat-grid{grid-template-columns:repeat(2,1fr)}}
    .stat-card{border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:5px;border:1px solid transparent}
    .stat-label{font-size:.74rem;opacity:.7;font-weight:500}
    .stat-val{font-family:'DM Mono',monospace;font-size:1.25rem}
    .stat-sub{font-size:.7rem;opacity:.5}
    .c-green{background:rgba(63,185,80,.1);border-color:rgba(63,185,80,.25);color:var(--green)}
    .c-orange{background:rgba(227,135,58,.1);border-color:rgba(227,135,58,.25);color:var(--orange)}
    .c-red{background:rgba(248,81,73,.1);border-color:rgba(248,81,73,.25);color:var(--red)}
    .c-blue{background:rgba(88,166,255,.1);border-color:rgba(88,166,255,.25);color:var(--blue)}
    .c-yellow{background:rgba(240,180,41,.1);border-color:rgba(240,180,41,.25);color:var(--yellow)}
    .c-teal{background:rgba(57,211,83,.1);border-color:rgba(57,211,83,.25);color:var(--teal)}
    .row-2col{display:grid;grid-template-columns:1fr 1fr;gap:18px}
    @media(max-width:620px){.row-2col{grid-template-columns:1fr}}
    .platform-row{display:flex;align-items:center;gap:10px;margin-bottom:10px}
    .plat-label{font-size:.8rem;width:56px;color:var(--muted)}
    .bar-wrap{flex:1;height:8px;background:var(--s2);border-radius:4px;overflow:hidden}
    .bar-fill{height:100%;border-radius:4px;transition:width .4s}
    .plat-amt{font-family:'DM Mono',monospace;font-size:.82rem;min-width:60px;text-align:right}
    .inv-summary{display:flex;gap:20px;margin-bottom:12px}
    .inv-summary div{display:flex;flex-direction:column;gap:2px}
    .inv-summary span{font-size:.74rem;color:var(--muted)}
    .inv-summary strong{font-family:'DM Mono',monospace;font-size:1rem}
    .inv-row{display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border);font-size:.83rem}
    .inv-row:last-child{border-bottom:none}
    .inv-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .inv-qty{color:var(--muted);font-family:'DM Mono',monospace;font-size:.78rem}
    .form-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px}
    @media(max-width:500px){.form-grid{grid-template-columns:1fr}}
    .span2{grid-column:span 2}
    label{display:flex;flex-direction:column;gap:5px;font-size:.8rem;color:var(--muted);font-weight:500}
    input,select{background:var(--s2);border:1px solid var(--border);border-radius:8px;color:var(--text);padding:9px 12px;font-size:.88rem;font-family:'Noto Sans SC',sans-serif;outline:none;transition:border-color .2s;width:100%}
    input:focus,select:focus{border-color:var(--accent)}
    input::placeholder{color:var(--muted);opacity:.5}
    .img-upload{background:var(--s2);border:1px dashed var(--border);border-radius:10px;min-height:90px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--muted);font-size:.85rem;overflow:hidden;transition:border-color .2s}
    .img-upload:hover{border-color:var(--accent)}
    .img-preview{max-width:100%;max-height:160px;object-fit:contain}
    .cost-summary{display:flex;gap:12px;margin-bottom:18px}
    .cost-summary div{flex:1;background:var(--s2);border:1px solid var(--border);border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:3px}
    .cost-summary span{font-size:.75rem;color:var(--muted)}
    .cost-summary strong{font-family:'DM Mono',monospace;font-size:1.1rem;color:var(--accent)}
    .btn-primary{background:var(--accent);color:#0a0c0f;border:none;border-radius:9px;padding:11px 24px;font-size:.9rem;font-weight:700;font-family:'Noto Sans SC',sans-serif;cursor:pointer;transition:opacity .2s;width:100%}
    .btn-primary:hover{opacity:.88}
    .btn-primary:disabled{opacity:.5;cursor:not-allowed}
    .btn-ghost{background:transparent;border:1px solid var(--border);border-radius:9px;color:var(--muted);padding:9px 18px;font-size:.85rem;font-family:'Noto Sans SC',sans-serif;cursor:pointer;transition:all .2s;width:100%}
    .btn-ghost:hover{border-color:var(--accent);color:var(--accent)}
    .del{background:transparent;border:none;color:var(--red);cursor:pointer;padding:3px 7px;border-radius:5px;font-size:.82rem;opacity:.6;transition:background .2s}
    .del:hover{background:rgba(248,81,73,.15);opacity:1}
    .del.abs{position:absolute;top:8px;right:8px}
    .tbl{width:100%;border-collapse:collapse;font-size:.82rem}
    .tbl th{text-align:left;padding:8px 10px;color:var(--muted);font-weight:500;border-bottom:1px solid var(--border)}
    .tbl td{padding:9px 10px;border-bottom:1px solid rgba(37,43,53,.6);vertical-align:middle}
    .tbl tr:last-child td{border-bottom:none}
    .tbl tfoot tr td{border-top:1px solid var(--border);padding-top:12px}
    .sku-badge{background:rgba(88,166,255,.15);color:var(--blue);border:1px solid rgba(88,166,255,.25);border-radius:5px;padding:2px 7px;font-size:.72rem;font-family:'DM Mono',monospace}
    .plat-tag{border-radius:5px;padding:2px 8px;font-size:.75rem;font-weight:600}
    .plat-tag.ebay{background:rgba(240,180,41,.15);color:var(--accent)}
    .plat-tag.mercari{background:rgba(63,185,80,.15);color:var(--green)}
    .plat-tag.other{background:rgba(107,117,133,.15);color:var(--muted)}
    .cat-badge{background:var(--s2);border:1px solid var(--border);border-radius:5px;padding:2px 7px;font-size:.72rem;color:var(--muted)}
    .purchase-list{display:flex;flex-direction:column;gap:12px}
    .purchase-item{display:flex;align-items:flex-start;gap:12px;padding:12px;background:var(--s2);border-radius:10px;position:relative}
    .thumb{width:56px;height:56px;object-fit:cover;border-radius:8px;flex-shrink:0}
    .purchase-info{flex:1;min-width:0}
    .purchase-name{font-weight:600;font-size:.9rem;margin-bottom:4px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
    .purchase-meta{font-size:.78rem;color:var(--muted)}
    .purchase-note{font-size:.75rem;color:var(--muted);margin-top:4px;font-style:italic}
    .inv-controls{display:flex;gap:10px;margin-bottom:18px;flex-wrap:wrap}
    .search-input{flex:1;min-width:160px}
    .filter-tabs{display:flex;gap:4px;flex-wrap:wrap}
    .ftab{background:var(--s2);border:1px solid var(--border);border-radius:7px;color:var(--muted);padding:6px 12px;font-size:.78rem;cursor:pointer;transition:all .2s;font-family:'Noto Sans SC',sans-serif}
    .ftab.active{background:var(--accent);border-color:var(--accent);color:#0a0c0f;font-weight:700}
    .inv-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px}
    .inv-card{background:var(--s2);border:1px solid var(--border);border-radius:12px;overflow:hidden;position:relative;display:flex;flex-direction:column}
    .inv-img-wrap{position:relative;cursor:pointer;overflow:hidden;height:130px;background:var(--bg)}
    .inv-img{width:100%;height:100%;object-fit:cover;display:block}
    .inv-img-placeholder{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:2rem;color:var(--border)}
    .img-overlay{position:absolute;inset:0;background:rgba(0,0,0,.5);color:#fff;font-size:.75rem;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .2s}
    .inv-img-wrap:hover .img-overlay{opacity:1}
    .inv-body{padding:12px;flex:1;display:flex;flex-direction:column;gap:6px}
    .inv-item-name{font-size:.85rem;font-weight:600;line-height:1.3}
    .inv-item-meta{font-size:.74rem;color:var(--muted);font-family:'DM Mono',monospace}
    .status-select{font-size:.75rem;padding:5px 8px;border-radius:6px}
    .s-green{border-color:rgba(63,185,80,.4);color:var(--green)}
    .s-blue{border-color:rgba(88,166,255,.4);color:var(--blue)}
    .s-muted{border-color:var(--border);color:var(--muted)}
    .s-orange{border-color:rgba(227,135,58,.4);color:var(--orange)}
    .inv-note{font-size:.74rem;color:var(--muted);cursor:pointer;font-style:italic;min-height:18px}
    .inv-note:hover{color:var(--text)}
    .tax-disclaimer{background:rgba(240,180,41,.06);border-color:rgba(240,180,41,.3);font-size:.84rem;line-height:1.6}
    .qtr-big{font-family:'DM Mono',monospace;font-size:2.4rem;color:var(--red);margin:16px 0 4px}
    .qtr-big span{font-size:1rem;color:var(--muted)}
    .qtr-dates{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:12px 0}
    .qtr-dates div{background:var(--s2);border:1px solid var(--border);border-radius:8px;padding:10px;font-size:.8rem;text-align:center}
    .qtr-dates strong{display:block;font-size:1rem;color:var(--accent);font-family:'DM Mono',monospace}
    .hint-text{font-size:.82rem;color:var(--muted);line-height:1.6}
    .empty{color:var(--muted);font-size:.85rem;text-align:center;padding:30px 0}
    .green{color:var(--green);font-family:'DM Mono',monospace}
    .red{color:var(--red);font-family:'DM Mono',monospace}
    .mono{font-family:'DM Mono',monospace;font-size:.82rem}
    .muted-sm{font-size:.74rem;color:var(--muted)}
  `}</style>;
}
