
const STORAGE_KEY="miDespensa_v1";
const HISTORY_KEY="miDespensa_history_v1";
const MEALS_KEY="miDespensa_meals_v1";
const CONSUMPTION_KEY="miDespensa_consumption_v1";
let products=load(STORAGE_KEY,[]);
let history=load(HISTORY_KEY,[]);
let meals=load(MEALS_KEY,[]);
let consumption=load(CONSUMPTION_KEY,[]);
let currentFilter="all",editingId=null,stockId=null,scanner=null,scanning=false;
let draftIngredients=[],detailMealId=null;

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
function load(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
function persist(){localStorage.setItem(STORAGE_KEY,JSON.stringify(products));localStorage.setItem(HISTORY_KEY,JSON.stringify(history.slice(0,500)));localStorage.setItem(MEALS_KEY,JSON.stringify(meals.slice(0,300)));localStorage.setItem(CONSUMPTION_KEY,JSON.stringify(consumption.slice(0,1000)));renderAll()}
function uid(){return crypto.randomUUID?.()||Date.now()+"-"+Math.random().toString(16).slice(2)}
function nowIso(){return new Date().toISOString()}
function dayKey(d=new Date()){return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10)}
function fmtDate(iso){return new Intl.DateTimeFormat("es-ES",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(iso))}
function esc(s=""){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function num(v){const n=Number(v);return Number.isFinite(n)?n:0}
function round1(v){return Math.round((num(v)+Number.EPSILON)*10)/10}
function defaultImage(){return "data:image/svg+xml;charset=UTF-8,"+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="100%" height="100%" rx="30" fill="#eeeee9"/><text x="50%" y="54%" text-anchor="middle" font-size="54">◫</text></svg>`)}
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.remove("show"),1900)}
function openModal(id){$("#"+id).classList.add("open")}
async function closeModal(id){$("#"+id).classList.remove("open");if(id==="scannerModal")await stopScanner()}
$$("[data-close]").forEach(b=>b.onclick=()=>closeModal(b.dataset.close));
function locationText(v){return v==="fridge"?"Nevera":"Armario"}
function hasMeasuredStock(p){return num(p.unitAmount)>0 && ["g","ml"].includes(p.unitMeasure||p.nutritionBasis)}
function ensureMeasuredStock(p){
 if(hasMeasuredStock(p) && p.stockAmount==null) p.stockAmount=round1(num(p.qty)*num(p.unitAmount));
 return p;
}
function stockAmount(p){ensureMeasuredStock(p);return hasMeasuredStock(p)?Math.max(0,num(p.stockAmount)):Math.max(0,num(p.qty))}
function stockMeasure(p){return hasMeasuredStock(p)?(p.unitMeasure||p.nutritionBasis||"g"):"ud."}
function stockLabel(p){return `${round1(stockAmount(p))} ${stockMeasure(p)}`}
function syncQtyFromStock(p){
 if(hasMeasuredStock(p)) p.qty=p.stockAmount>0?Math.ceil(num(p.stockAmount)/num(p.unitAmount)):0;
}
products.forEach(ensureMeasuredStock);

function productCard(p){
 ensureMeasuredStock(p);
 const available=stockAmount(p), lowLimit=hasMeasuredStock(p)?num(p.minStock)*num(p.unitAmount):num(p.minStock);
 const cls=available===0?"zero":available<=lowLimit?"low":"";
 const nutrition=p.kcal100?` · ${round1(p.kcal100)} kcal/100${p.nutritionBasis||"g"}`:"";
 return `<article class="product-card" data-product="${p.id}"><img class="product-thumb" src="${esc(p.image||defaultImage())}" alt=""><div><h3>${esc(p.name||"Producto sin nombre")}</h3><p>${esc(p.brand||"")} ${p.brand?"·":""} ${locationText(p.location)}${nutrition}${p.expiry?" · cad. "+new Date(p.expiry+"T12:00").toLocaleDateString("es-ES",{day:"2-digit",month:"short"}):""}</p></div><div class="qty-pill ${cls}">${hasMeasuredStock(p)?`${round1(available)}<small>${stockMeasure(p)}</small>`:p.qty}</div></article>`
}

function mealTotals(ingredients){
 return ingredients.reduce((a,i)=>{
   const f=num(i.amount)/100;
   a.kcal+=num(i.kcal100)*f;a.protein+=num(i.protein100)*f;a.carbs+=num(i.carbs100)*f;a.fat+=num(i.fat100)*f;return a
 },{kcal:0,protein:0,carbs:0,fat:0})
}
function renderAll(){
 products.forEach(ensureMeasuredStock);
 const total=products.filter(p=>stockAmount(p)>0).length,fridge=products.filter(p=>p.location==="fridge"&&stockAmount(p)>0).length,pantry=products.filter(p=>p.location==="pantry"&&stockAmount(p)>0).length;
 $("#totalUnits").textContent=total;$("#fridgeUnits").textContent=fridge;$("#pantryUnits").textContent=pantry;$("#totalProductsText").textContent=`${products.length} producto${products.length===1?"":"s"} registrados`;
 const attention=[],today=new Date();today.setHours(0,0,0,0);
 products.forEach(p=>{const available=stockAmount(p),lowLimit=hasMeasuredStock(p)?num(p.minStock)*num(p.unitAmount):num(p.minStock);if(available<=lowLimit)attention.push({p,type:available===0?"danger":"",text:available===0?"Sin stock":`Stock bajo: ${stockLabel(p)}`});if(p.expiry){const exp=new Date(p.expiry+"T00:00:00"),days=Math.ceil((exp-today)/86400000);if(days<=3)attention.push({p,type:days<0?"danger":"",text:days<0?"Caducado":days===0?"Caduca hoy":`Caduca en ${days} día${days===1?"":"s"}`})}});
 $("#attentionList").innerHTML=attention.length?attention.slice(0,6).map(a=>`<div class="attention-card ${a.type}" data-product="${a.p.id}"><span class="alert-dot"></span><div><strong>${esc(a.p.name)}</strong><small>${a.text}</small></div></div>`).join(""):`<div class="empty">Todo está bajo control.</div>`;
 const recent=[...products].sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt)).slice(0,5);$("#recentList").innerHTML=recent.length?recent.map(productCard).join(""):`<div class="empty">Escanea tu primer producto para empezar.</div>`;
 const q=$("#searchInput")?.value?.trim().toLowerCase()||"";let list=products.filter(p=>currentFilter==="all"||p.location===currentFilter);if(q)list=list.filter(p=>[p.name,p.brand,p.barcode].some(x=>(x||"").toLowerCase().includes(q)));list.sort((a,b)=>a.name.localeCompare(b.name,"es"));$("#inventoryList").innerHTML=list.length?list.map(productCard).join(""):`<div class="empty">No hay productos con este filtro.</div>`;
 $("#historyList").innerHTML=history.length?history.slice(0,120).map(h=>`<div class="history-card"><div class="history-icon">${h.delta>0?"+":"−"}</div><div><p>${esc(h.name)}</p><small>${h.reason} · ${fmtDate(h.at)}</small></div><div class="history-delta ${h.delta>0?"plus":"minus"}">${h.delta>0?"+":""}${h.delta}</div></div>`).join(""):`<div class="empty">Todavía no hay movimientos.</div>`;
 const todayConsumption=consumption.filter(c=>c.date===dayKey());
 const dayTotals=todayConsumption.reduce((a,c)=>{a.kcal+=num(c.calories);a.protein+=num(c.protein);a.carbs+=num(c.carbs);a.fat+=num(c.fat);return a},{kcal:0,protein:0,carbs:0,fat:0});
 $("#todayConsumedKcal").textContent=Math.round(dayTotals.kcal);$("#todayConsumedItems").textContent=todayConsumption.length;$("#todayConsumedProtein").textContent=round1(dayTotals.protein);$("#todayConsumedCarbs").textContent=round1(dayTotals.carbs);$("#todayConsumedFat").textContent=round1(dayTotals.fat);
 $("#todayConsumptionList").innerHTML=todayConsumption.length?todayConsumption.map(c=>`<article class="consumption-card"><div><h3>${esc(c.name)}</h3><p>${esc(c.meal)} · ${round1(c.amount)} ${c.basis} retirados del stock</p></div><div><strong>${Math.round(c.calories)} kcal</strong><button data-delete-consumption="${c.id}" aria-label="Eliminar registro">×</button></div></article>`).join(""):`<div class="empty">Cuando pulses Consumir en un producto aparecerá aquí.</div>`;
 $("#mealCount").textContent=meals.length;
 $("#mealsList").innerHTML=meals.length?meals.map(m=>{const t=m.totals||mealTotals(m.ingredients||[]);return `<article class="meal-card" data-meal="${m.id}"><div><h3>${esc(m.name)}</h3><p>${m.ingredients.length} ingrediente${m.ingredients.length===1?"":"s"} · ${fmtDate(m.createdAt)}</p></div><div class="meal-kcal">${Math.round(t.kcal)} <small>kcal</small></div></article>`}).join(""):`<div class="empty">Todavía no has guardado ninguna comida.</div>`;
}

function go(view){$$(".view").forEach(v=>v.classList.remove("active"));$("#"+view+"View").classList.add("active");$$(".nav-item[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===view));window.scrollTo({top:0,behavior:"smooth"})}
$$(".nav-item[data-view]").forEach(b=>b.onclick=()=>go(b.dataset.view));$$("[data-go]").forEach(b=>b.onclick=()=>go(b.dataset.go));
document.addEventListener("click",e=>{const card=e.target.closest("[data-product]");if(card)openStock(card.dataset.product);const meal=e.target.closest("[data-meal]");if(meal)openMealDetail(meal.dataset.meal)});
$("#searchInput").addEventListener("input",renderAll);$$("#locationFilter button").forEach(b=>b.onclick=()=>{currentFilter=b.dataset.filter;$$("#locationFilter button").forEach(x=>x.classList.toggle("active",x===b));renderAll()});

function resetEditor(){
 editingId=null;$("#productModalEyebrow").textContent="NUEVO PRODUCTO";$("#productModalTitle").textContent="Añadir producto";$("#productImage").src=defaultImage();$("#productName").value="";$("#productBrand").value="";$("#productBarcode").value="";$("#productLocation").value="fridge";$("#productQty").value=1;$("#productMinStock").value=1;$("#productExpiry").value="";$("#productKcal100").value="";$("#productProtein100").value="";$("#productCarbs100").value="";$("#productFat100").value="";$("#productNutritionBasis").value="g";$("#productUnitAmount").value="";$("#productUnitMeasure").value="g";$("#nutritionSource").textContent="Manual";$("#deleteProductBtn").classList.add("hidden")
}
function openEditor(p=null){
 if(!p)resetEditor();else{editingId=p.id;$("#productModalEyebrow").textContent="EDITAR PRODUCTO";$("#productModalTitle").textContent=p.name;$("#productImage").src=p.image||defaultImage();$("#productName").value=p.name||"";$("#productBrand").value=p.brand||"";$("#productBarcode").value=p.barcode||"";$("#productLocation").value=p.location||"fridge";$("#productQty").value=p.qty??1;$("#productMinStock").value=p.minStock??1;$("#productExpiry").value=p.expiry||"";$("#productKcal100").value=p.kcal100??"";$("#productProtein100").value=p.protein100??"";$("#productCarbs100").value=p.carbs100??"";$("#productFat100").value=p.fat100??"";$("#productNutritionBasis").value=p.nutritionBasis||"g";$("#productUnitAmount").value=p.unitAmount??"";$("#productUnitMeasure").value=p.unitMeasure||p.nutritionBasis||"g";$("#nutritionSource").textContent=p.nutritionSource||"Manual";$("#deleteProductBtn").classList.remove("hidden")}openModal("productModal")
}
$("#manualAddBtn").onclick=()=>openEditor();$("#qtyMinus").onclick=()=>$("#productQty").value=Math.max(0,num($("#productQty").value)-1);$("#qtyPlus").onclick=()=>$("#productQty").value=num($("#productQty").value)+1;
$("#saveProductBtn").onclick=()=>{
 const name=$("#productName").value.trim();if(!name){toast("Escribe un nombre");return}
 const data={name,brand:$("#productBrand").value.trim(),barcode:$("#productBarcode").value.trim(),location:$("#productLocation").value,qty:Math.max(0,num($("#productQty").value)),minStock:Math.max(0,num($("#productMinStock").value)),expiry:$("#productExpiry").value,image:$("#productImage").src&& !$("#productImage").src.startsWith(location.href)?$("#productImage").src:"",kcal100:num($("#productKcal100").value)||null,protein100:num($("#productProtein100").value)||null,carbs100:num($("#productCarbs100").value)||null,fat100:num($("#productFat100").value)||null,nutritionBasis:$("#productNutritionBasis").value,unitAmount:num($("#productUnitAmount").value)||null,unitMeasure:$("#productUnitMeasure").value,nutritionSource:$("#nutritionSource").textContent,updatedAt:nowIso()};
 if(editingId){
   const idx=products.findIndex(p=>p.id===editingId),old=products[idx];
   const packageDefinitionChanged=num(old?.unitAmount)!==num(data.unitAmount)||(old?.unitMeasure||"")!==(data.unitMeasure||"");
   const packageCountChanged=num(old?.qty)!==num(data.qty);
   products[idx]={...old,...data};
   const updated=products[idx];
   if(hasMeasuredStock(updated)&&(old?.stockAmount==null||packageDefinitionChanged||packageCountChanged)) updated.stockAmount=round1(data.qty*num(data.unitAmount));
   if(old&&packageCountChanged)addHistory(updated,data.qty-num(old.qty),"Ajuste manual");
 } else {
   const same=data.barcode&&products.find(p=>p.barcode===data.barcode);
   if(same){ensureMeasuredStock(same);same.qty+=data.qty;if(hasMeasuredStock({...same,...data}))same.stockAmount=round1(stockAmount(same)+data.qty*num(data.unitAmount));same.updatedAt=nowIso();addHistory(same,data.qty,"Entrada");toast(`Añadidas ${data.qty} ud.`)}
   else{const p={id:uid(),createdAt:nowIso(),...data};if(hasMeasuredStock(p))p.stockAmount=round1(p.qty*num(p.unitAmount));products.push(p);addHistory(p,p.qty,"Alta inicial")}
 }
 persist();closeModal("productModal")
};
$("#deleteProductBtn").onclick=()=>{if(!editingId)return;if(confirm("¿Eliminar este producto del inventario?")){products=products.filter(p=>p.id!==editingId);persist();closeModal("productModal");toast("Producto eliminado")}};

function openStock(id){const p=products.find(x=>x.id===id);if(!p)return;ensureMeasuredStock(p);stockId=id;$("#stockProductName").textContent=p.name;$("#stockCurrent").textContent=hasMeasuredStock(p)?round1(stockAmount(p)):p.qty;$("#stockCurrentUnit").textContent=hasMeasuredStock(p)?stockMeasure(p):"unidades disponibles";$("#moveQty").value=1;openModal("stockModal")}
$("#moveQtyMinus").onclick=()=>$("#moveQty").value=Math.max(1,num($("#moveQty").value)-1);$("#moveQtyPlus").onclick=()=>$("#moveQty").value=Math.max(1,num($("#moveQty").value)+1);
$("#addStockBtn").onclick=()=>{const p=products.find(x=>x.id===stockId);if(!p)return;ensureMeasuredStock(p);const packs=Math.max(1,num($("#moveQty").value));if(hasMeasuredStock(p)){p.stockAmount=round1(stockAmount(p)+packs*num(p.unitAmount));syncQtyFromStock(p)}else p.qty+=packs;p.updatedAt=nowIso();addHistory(p,packs,"Entrada");$("#stockCurrent").textContent=hasMeasuredStock(p)?round1(stockAmount(p)):p.qty;$("#moveQty").value=1;persist();toast(hasMeasuredStock(p)?`Añadidos ${round1(packs*num(p.unitAmount))} ${stockMeasure(p)}`:`Añadidas ${packs} ud.`)};
function openConsume(){const p=products.find(x=>x.id===stockId);if(!p)return;ensureMeasuredStock(p);if(stockAmount(p)<=0){toast("No queda stock");return}const basis=hasMeasuredStock(p)?stockMeasure(p):(p.nutritionBasis||"g");$("#consumeProductName").textContent=p.name;$("#consumeUnitsLabel").textContent=stockLabel(p);$("#consumeAmountLabel").childNodes[0].nodeValue=`Cantidad realmente consumida (${basis}) `;$("#consumeAmount").value=hasMeasuredStock(p)?Math.min(stockAmount(p),num(p.unitAmount)||100):"";$("#consumeAmount").max=hasMeasuredStock(p)?stockAmount(p):"";$("#consumeMeal").value="Comida";updateConsumePreview();closeModal("stockModal");openModal("consumeModal")}
$("#consumeStockBtn").onclick=openConsume;
$("#consumeAmount").oninput=updateConsumePreview;
function updateConsumePreview(){const p=products.find(x=>x.id===stockId);if(!p)return;const amount=Math.max(0,num($("#consumeAmount").value)),factor=amount/100;$("#consumeKcalPreview").textContent=Math.round(num(p.kcal100)*factor);$("#consumeProteinPreview").textContent=round1(num(p.protein100)*factor);$("#consumeCarbsPreview").textContent=round1(num(p.carbs100)*factor);$("#consumeFatPreview").textContent=round1(num(p.fat100)*factor);const warning=$("#consumeWarning");if(hasMeasuredStock(p)&&amount>stockAmount(p)){warning.textContent=`No puedes consumir más de ${stockLabel(p)}.`;warning.classList.remove("hidden")}else if(!num(p.kcal100)){warning.textContent="Este producto no tiene calorías guardadas. Se descontará del stock, pero no se podrán calcular kcal hasta completar su ficha nutricional.";warning.classList.remove("hidden")}else if(!amount){warning.textContent="Indica los gramos/ml consumidos para calcular las calorías.";warning.classList.remove("hidden")}else{warning.classList.add("hidden")}}
$("#confirmConsumeBtn").onclick=()=>{const p=products.find(x=>x.id===stockId);if(!p)return;ensureMeasuredStock(p);const amount=Math.max(0,num($("#consumeAmount").value)),basis=hasMeasuredStock(p)?stockMeasure(p):(p.nutritionBasis||"g");if(amount<=0){toast("Indica la cantidad consumida");return}if(hasMeasuredStock(p)&&amount>stockAmount(p)){toast(`Solo quedan ${stockLabel(p)}`);return}const factor=amount/100,entry={id:uid(),productId:p.id,name:p.name,date:dayKey(),at:nowIso(),meal:$("#consumeMeal").value,amount,basis,calories:num(p.kcal100)*factor,protein:num(p.protein100)*factor,carbs:num(p.carbs100)*factor,fat:num(p.fat100)*factor};if(hasMeasuredStock(p)){p.stockAmount=round1(Math.max(0,stockAmount(p)-amount));syncQtyFromStock(p)}else{p.qty=Math.max(0,p.qty-1)}p.updatedAt=nowIso();consumption.unshift(entry);addHistory(p,-amount,"Consumo");persist();closeModal("consumeModal");toast(`${round1(amount)} ${basis} consumidos · quedan ${stockLabel(p)} · ${Math.round(entry.calories)} kcal`)};
$("#discardProductBtn").onclick=()=>{const p=products.find(x=>x.id===stockId);if(!p)return;ensureMeasuredStock(p);if(stockAmount(p)<=0){toast("No queda stock");return}if(hasMeasuredStock(p)){const raw=prompt(`¿Cuántos ${stockMeasure(p)} quieres descartar? No se registrarán calorías.`,String(round1(stockAmount(p))));if(raw===null)return;const amount=Math.max(0,num(raw));if(!amount||amount>stockAmount(p)){toast(`Introduce una cantidad entre 0 y ${round1(stockAmount(p))} ${stockMeasure(p)}`);return}p.stockAmount=round1(stockAmount(p)-amount);syncQtyFromStock(p);p.updatedAt=nowIso();addHistory(p,-amount,"Descarte");$("#stockCurrent").textContent=round1(stockAmount(p));persist();toast(`${round1(amount)} ${stockMeasure(p)} descartados · quedan ${stockLabel(p)} · 0 kcal`)}else{const units=Math.min(Math.max(1,num($("#moveQty").value)),p.qty);if(confirm(`¿Eliminar ${units} ud. de ${p.name}? No se registrarán calorías.`)){p.qty=Math.max(0,p.qty-units);p.updatedAt=nowIso();addHistory(p,-units,"Descarte");$("#stockCurrent").textContent=p.qty;persist();toast(`${units} ud. descartadas · 0 kcal`)}}};
$("#editFromStockBtn").onclick=()=>{const p=products.find(x=>x.id===stockId);closeModal("stockModal");openEditor(p)};
function addHistory(p,delta,reason){if(!delta)return;history.unshift({id:uid(),productId:p.id,name:p.name,delta,reason,at:nowIso()})}

async function fetchProduct(barcode){
 const clean=barcode.replace(/\D/g,"");if(!clean){toast("Código no válido");return}const existing=products.find(p=>p.barcode===clean);if(existing){await stopScanner();closeModal("scannerModal");openStock(existing.id);toast("Producto ya registrado");return}
 toast("Buscando producto…");
 try{
  const fields="product_name,product_name_es,brands,image_front_small_url,image_front_url,nutriments,serving_quantity,serving_quantity_unit,product_quantity,product_quantity_unit,quantity";
  const r=await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(clean)}?fields=${fields}`),data=await r.json();await stopScanner();closeModal("scannerModal");resetEditor();$("#productBarcode").value=clean;
  if(data.status===1&&data.product){
    const p=data.product,n=p.nutriments||{};$("#productName").value=p.product_name_es||p.product_name||"";$("#productBrand").value=p.brands||"";$("#productImage").src=p.image_front_small_url||p.image_front_url||defaultImage();$("#productModalTitle").textContent=p.product_name_es||p.product_name||"Nuevo producto";
    const kcal=n["energy-kcal_100g"]??(n["energy-kj_100g"]?num(n["energy-kj_100g"])/4.184:null);$("#productKcal100").value=kcal?round1(kcal):"";$("#productProtein100").value=n.proteins_100g??"";$("#productCarbs100").value=n.carbohydrates_100g??"";$("#productFat100").value=n.fat_100g??"";
    let unit=(p.product_quantity_unit||p.serving_quantity_unit||"").toLowerCase(),packageAmount=num(p.product_quantity)||num(p.serving_quantity);
    if((!packageAmount||!unit)&&p.quantity){const m=String(p.quantity).replace(",",".").match(/([0-9.]+)\s*(kg|g|l|ml)\b/i);if(m){packageAmount=num(m[1]);unit=m[2].toLowerCase();if(unit==="kg"){packageAmount*=1000;unit="g"}if(unit==="l"){packageAmount*=1000;unit="ml"}}}
    if(unit==="l"){packageAmount*=1000;unit="ml"}if(unit==="kg"){packageAmount*=1000;unit="g"}
    const basis=unit==="ml"?"ml":"g";$("#productNutritionBasis").value=basis;$("#productUnitMeasure").value=basis;$("#productUnitAmount").value=packageAmount||"";$("#nutritionSource").textContent="Open Food Facts";toast(packageAmount?(kcal?"Producto, contenido y nutrición encontrados":"Producto y contenido encontrados · faltan kcal"):(kcal?"Producto y nutrición encontrados · revisa el contenido del envase":"Producto encontrado · revisa contenido y kcal"))
  }else{$("#productModalTitle").textContent="Producto no encontrado";toast("Completa los datos manualmente")}
  openModal("productModal")
 }catch(err){await stopScanner();closeModal("scannerModal");resetEditor();$("#productBarcode").value=clean;openModal("productModal");toast("Sin datos online. Añádelo manualmente")}
}
function normalizeBarcode(raw){
 const digits=String(raw||"").replace(/\D/g,"");
 // Algunos lectores devuelven UPC-A como EAN-13 anteponiendo 0.
 if(digits.length===13 && digits.startsWith("0") && validUpcA(digits.slice(1))) return digits.slice(1);
 return digits;
}
function validEan13(code){
 if(!/^\d{13}$/.test(code))return false;
 let sum=0;for(let i=0;i<12;i++)sum+=Number(code[i])*(i%2===0?1:3);
 return ((10-(sum%10))%10)===Number(code[12]);
}
function validEan8(code){
 if(!/^\d{8}$/.test(code))return false;
 let sum=0;for(let i=0;i<7;i++)sum+=Number(code[i])*(i%2===0?3:1);
 return ((10-(sum%10))%10)===Number(code[7]);
}
function validUpcA(code){
 if(!/^\d{12}$/.test(code))return false;
 let sum=0;for(let i=0;i<11;i++)sum+=Number(code[i])*(i%2===0?3:1);
 return ((10-(sum%10))%10)===Number(code[11]);
}
function validRetailBarcode(raw){
 const code=String(raw||"").replace(/\D/g,"");
 return validEan13(code)||validEan8(code)||validUpcA(code);
}
function setPhotoScanResult(type,title,detail=""){
 const box=$("#barcodeScanResult");
 box.innerHTML=`<div class="scan-result ${type}"><strong>${esc(title)}</strong>${detail?`<small>${esc(detail)}</small>`:""}</div>`;
}
async function fileToImage(file){
 return await new Promise((resolve,reject)=>{
  const url=URL.createObjectURL(file),img=new Image();
  img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};
  img.onerror=e=>{URL.revokeObjectURL(url);reject(e)};
  img.src=url;
 });
}
function canvasFromImage(img,maxSide=2400){
 const scale=Math.min(1,maxSide/Math.max(img.naturalWidth,img.naturalHeight));
 const c=document.createElement("canvas");
 c.width=Math.max(1,Math.round(img.naturalWidth*scale));c.height=Math.max(1,Math.round(img.naturalHeight*scale));
 c.getContext("2d",{willReadFrequently:true}).drawImage(img,0,0,c.width,c.height);return c;
}
function cloneCanvas(src){const c=document.createElement("canvas");c.width=src.width;c.height=src.height;c.getContext("2d").drawImage(src,0,0);return c}
function cropCanvas(src,x,y,w,h){const c=document.createElement("canvas");c.width=Math.max(1,Math.round(w));c.height=Math.max(1,Math.round(h));c.getContext("2d").drawImage(src,x,y,w,h,0,0,c.width,c.height);return c}
function rotateCanvas(src,deg){
 const rad=deg*Math.PI/180,swap=Math.abs(deg)%180===90,c=document.createElement("canvas");c.width=swap?src.height:src.width;c.height=swap?src.width:src.height;
 const ctx=c.getContext("2d");ctx.translate(c.width/2,c.height/2);ctx.rotate(rad);ctx.drawImage(src,-src.width/2,-src.height/2);return c;
}
function preprocessCanvas(src,mode){
 const c=cloneCanvas(src),ctx=c.getContext("2d",{willReadFrequently:true}),im=ctx.getImageData(0,0,c.width,c.height),d=im.data;
 let min=255,max=0;
 for(let i=0;i<d.length;i+=4){const g=.299*d[i]+.587*d[i+1]+.114*d[i+2];if(g<min)min=g;if(g>max)max=g}
 const range=Math.max(35,max-min);
 // Umbral de Otsu para binarización robusta.
 const hist=new Array(256).fill(0);for(let i=0;i<d.length;i+=4){hist[Math.max(0,Math.min(255,Math.round(.299*d[i]+.587*d[i+1]+.114*d[i+2])))]++}
 const total=c.width*c.height;let sum=0;for(let i=0;i<256;i++)sum+=i*hist[i];let sumB=0,wB=0,maxVar=0,otsu=128;
 for(let i=0;i<256;i++){wB+=hist[i];if(!wB)continue;const wF=total-wB;if(!wF)break;sumB+=i*hist[i];const mB=sumB/wB,mF=(sum-sumB)/wF,v=wB*wF*(mB-mF)*(mB-mF);if(v>maxVar){maxVar=v;otsu=i}}
 for(let i=0;i<d.length;i+=4){const g=.299*d[i]+.587*d[i+1]+.114*d[i+2];let v=g;
  if(mode==="gray")v=g;
  if(mode==="contrast")v=Math.max(0,Math.min(255,(g-min)*255/range));
  if(mode==="threshold")v=g>otsu?255:0;
  if(mode==="thresholdLow")v=g>Math.max(65,otsu-22)?255:0;
  if(mode==="thresholdHigh")v=g>Math.min(205,otsu+22)?255:0;
  d[i]=d[i+1]=d[i+2]=v;
 }
 ctx.putImageData(im,0,0);return c;
}
function buildBarcodeCanvases(base){
 const W=base.width,H=base.height,items=[];
 const add=(name,c)=>items.push({name,canvas:c});
 add("original",base);
 add("centro",cropCanvas(base,W*.06,H*.18,W*.88,H*.64));
 add("banda-centro",cropCanvas(base,W*.03,H*.30,W*.94,H*.40));
 add("banda-superior",cropCanvas(base,W*.03,H*.08,W*.94,H*.52));
 add("banda-inferior",cropCanvas(base,W*.03,H*.40,W*.94,H*.52));
 const seeds=[...items];
 for(const it of seeds){add(it.name+"-contraste",preprocessCanvas(it.canvas,"contrast"));add(it.name+"-umbral",preprocessCanvas(it.canvas,"threshold"))}
 // Las dos rotaciones cubren fotos tomadas con el móvil girado.
 add("rot90",rotateCanvas(base,90));add("rot270",rotateCanvas(base,270));
 return items;
}
async function canvasToFile(c,name){return await new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(new File([b],`${name}.jpg`,{type:"image/jpeg"})):reject(new Error("No se pudo preparar imagen")),"image/jpeg",.96))}
function addBarcodeVote(votes,raw,source){
 const code=normalizeBarcode(raw);if(!validRetailBarcode(code))return false;
 if(!votes.has(code))votes.set(code,new Set());votes.get(code).add(source);return true;
}
async function detectNativeBarcode(canvas,votes,label){
 if(!("BarcodeDetector" in globalThis))return;
 try{
  let formats;try{const supported=await BarcodeDetector.getSupportedFormats();formats=["ean_13","ean_8","upc_a","upc_e"].filter(x=>supported.includes(x))}catch{}
  const detector=formats?.length?new BarcodeDetector({formats}):new BarcodeDetector();
  const found=await detector.detect(canvas);for(const b of found||[])addBarcodeVote(votes,b.rawValue,`native:${label}`);
 }catch(e){}
}
async function detectZxingBarcode(canvas,votes,label){
 if(typeof ZXingBrowser==="undefined")return;
 try{
  const reader=new ZXingBrowser.BrowserMultiFormatOneDReader();
  const result=reader.decodeFromCanvas(canvas);addBarcodeVote(votes,result?.getText?.()||result?.text||String(result||""),`zxing:${label}`);
 }catch(e){}
}
async function detectHtml5Barcode(canvas,votes,label,reader){
 if(!reader)return;
 try{const file=await canvasToFile(canvas,"scan-"+label.replace(/[^a-z0-9_-]/gi,"-"));const decoded=await reader.scanFile(file,false);addBarcodeVote(votes,decoded,`html5:${label}`)}catch(e){}
}

function yieldToUi(){return new Promise(resolve=>setTimeout(resolve,0));}
function scaleCanvas(src,factor){
 const c=document.createElement("canvas");c.width=Math.max(1,Math.round(src.width*factor));c.height=Math.max(1,Math.round(src.height*factor));
 const ctx=c.getContext("2d");ctx.imageSmoothingEnabled=factor<1;ctx.imageSmoothingQuality="high";ctx.drawImage(src,0,0,c.width,c.height);return c;
}
function buildAppleFocusedCanvases(base){
 const W=base.width,H=base.height,out=[];
 const push=(name,c)=>out.push({name,canvas:c});
 // En fotos de iPhone el código suele ocupar una franja horizontal. Probamos varias zonas,
 // incluyendo imágenes donde el usuario no haya centrado perfectamente el código.
 const bands=[
  ["full",0,0,1,1],["middle",.02,.20,.96,.60],["mid-tight",.02,.30,.96,.40],
  ["upper",.02,.05,.96,.55],["lower",.02,.40,.96,.55],
  ["left",0,.12,.72,.76],["right",.28,.12,.72,.76]
 ];
 for(const [name,x,y,w,h] of bands){
  const crop=cropCanvas(base,W*x,H*y,W*w,H*h);push(name,crop);
  // Aumentar un recorte puede ayudar mucho cuando el código ocupa pocos píxeles en una foto de 12/24/48 MP.
  if(crop.width<1800)push(name+"-up",scaleCanvas(crop,Math.min(2.0,1800/crop.width)));
 }
 const originals=[...out];
 for(const it of originals){
  push(it.name+"-contrast",preprocessCanvas(it.canvas,"contrast"));
  push(it.name+"-threshold",preprocessCanvas(it.canvas,"threshold"));
 }
 push("rotate90",rotateCanvas(base,90));push("rotate270",rotateCanvas(base,270));
 return out;
}
function barcodeCandidatesFromText(text){
 const compact=String(text||"").replace(/[^0-9\n ]/g," ");
 const candidates=new Set();
 for(const line of compact.split(/\n+/)){
  const digits=line.replace(/\D/g,"");
  for(const len of [13,12,8]){
   if(digits.length===len)candidates.add(digits);
   if(digits.length>len){for(let i=0;i<=digits.length-len;i++)candidates.add(digits.slice(i,i+len));}
  }
 }
 return [...candidates].filter(validRetailBarcode);
}
async function detectOcrBarcode(base,votes){
 if(typeof Tesseract==="undefined")return;
 // OCR es solo respaldo: lee los dígitos impresos debajo de las barras. Nunca se acepta sin checksum EAN/UPC.
 const W=base.width,H=base.height;
 const zones=[
  ["digits-lower",cropCanvas(base,0,H*.50,W,H*.48)],
  ["digits-middle",cropCanvas(base,0,H*.35,W,H*.55)],
  ["digits-full",base]
 ];
 for(const [name,canvas] of zones){
  try{
   setPhotoScanResult("working","Leyendo números impresos…",`Comprobación OCR: ${name}`);
   const data=await Tesseract.recognize(canvas,"eng",{logger:()=>{}});
   for(const code of barcodeCandidatesFromText(data?.data?.text||""))addBarcodeVote(votes,code,`ocr:${name}`);
   if([...votes.values()].some(v=>v.size>=2))return;
  }catch(e){}
  await yieldToUi();
 }
}
async function decodeBarcodeFile(file){
 const img=await fileToImage(file),base=canvasFromImage(img,3200),variants=buildAppleFocusedCanvases(base),votes=new Map();
 const h5=typeof Html5Qrcode!=="undefined"?new Html5Qrcode("reader"):null;
 try{
  // 1) Motores rápidos. BarcodeDetector (cuando Safari lo ofrezca) + ZXing.
  for(let i=0;i<variants.length;i++){
   const v=variants[i];
   setPhotoScanResult("working","Analizando fotografía…",`Intento ${i+1} de ${variants.length}`);
   await detectNativeBarcode(v.canvas,votes,v.name);
   await detectZxingBarcode(v.canvas,votes,v.name);
   const ranked=[...votes.entries()].sort((a,b)=>b[1].size-a[1].size);
   if(ranked[0]&&ranked[0][1].size>=2)return ranked[0][0];
   if(i%3===2)await yieldToUi();
  }
  // 2) Segundo decodificador independiente sobre las variantes con más probabilidad.
  if(h5){
   const preferred=variants.filter(v=>/^(full|middle|mid-tight|lower|upper)(-|$)/.test(v.name)).slice(0,18);
   for(let i=0;i<preferred.length;i++){
    const v=preferred[i];setPhotoScanResult("working","Segunda comprobación…",`Decodificación ${i+1} de ${preferred.length}`);
    await detectHtml5Barcode(v.canvas,votes,v.name,h5);
    const ranked=[...votes.entries()].sort((a,b)=>b[1].size-a[1].size);
    if(ranked[0]&&ranked[0][1].size>=2)return ranked[0][0];
    if(i%2===1)await yieldToUi();
   }
  }
  // 3) Respaldo: OCR de los números impresos. Se usa solo con validación matemática EAN/UPC.
  await detectOcrBarcode(base,votes);
 }finally{try{await h5?.clear()}catch(e){}}
 const ranked=[...votes.entries()].sort((a,b)=>b[1].size-a[1].size);
 if(ranked.length)return ranked[0][0];
 throw new Error("No se ha podido extraer un EAN/UPC válido. Repite la foto más cerca, con todas las barras y los números visibles, evitando reflejos.");
}
async function processBarcodePhoto(file){
 if(!file)return;
 const previewUrl=URL.createObjectURL(file);
 $("#barcodePhotoPreview").src=previewUrl;
 $("#barcodePhotoPreviewWrap").classList.remove("hidden");
 $("#barcodeProcessing").classList.remove("hidden");
 $("#barcodeScanResult").innerHTML="";
 try{
  const code=await decodeBarcodeFile(file);
  $("#manualBarcode").value=code;
  setPhotoScanResult("ok",`Código detectado: ${code}`,"Código validado. Buscando el producto automáticamente…");
  if(navigator.vibrate){try{navigator.vibrate(70)}catch(e){}}
  await new Promise(r=>setTimeout(r,250));
  await fetchProduct(code);
 }catch(err){
  console.error("Error procesando la fotografía del código:",err);
  setPhotoScanResult("error","No se pudo obtener un código válido",err?.message||"Repite la foto más cerca, recta y sin reflejos.");
 }finally{
  $("#barcodeProcessing").classList.add("hidden");
  setTimeout(()=>URL.revokeObjectURL(previewUrl),30000);
 }
}
function openScanner(){
 openModal("scannerModal");
 $("#manualBarcode").value="";$("#barcodePhotoInput").value="";$("#barcodeScanResult").innerHTML="";
 $("#barcodePhotoPreviewWrap").classList.add("hidden");$("#barcodeProcessing").classList.add("hidden");
 // IMPORTANTE EN iOS/Safari: click() debe ejecutarse dentro del gesto original del usuario.
 // No usar setTimeout ni promesas antes de abrir el selector/cámara.
 $("#barcodePhotoInput").click();
}
$("#scanFab").onclick=openScanner;$("#quickScanBtn").onclick=openScanner;
$("#takeBarcodePhotoBtn").onclick=()=>{$("#barcodePhotoInput").value="";$("#barcodePhotoInput").click()};
$("#barcodePhotoInput").onchange=async e=>{const file=e.target.files?.[0];if(file)await processBarcodePhoto(file)};
$("#manualBarcodeBtn").onclick=()=>{const code=normalizeBarcode($("#manualBarcode").value);if(!validRetailBarcode(code)){setPhotoScanResult("error","Código manual no válido","Comprueba el EAN/UPC y su dígito de control.");return}fetchProduct(code)};
$("#manualBarcode").addEventListener("keydown",e=>{if(e.key==="Enter")$("#manualBarcodeBtn").click()});
async function stopScanner(){return;}

function openNewMeal(){draftIngredients=[];$("#mealName").value="";renderDraftMeal();openModal("mealModal")}
$("#newMealBtn").onclick=openNewMeal;$("#newMealLargeBtn").onclick=openNewMeal;
function renderDraftMeal(){
 const t=mealTotals(draftIngredients);$("#mealTotalKcal").textContent=Math.round(t.kcal);$("#mealProtein").textContent=round1(t.protein);$("#mealCarbs").textContent=round1(t.carbs);$("#mealFat").textContent=round1(t.fat);
 $("#mealIngredients").innerHTML=draftIngredients.length?draftIngredients.map((i,idx)=>`<div class="ingredient-row"><div><h4>${esc(i.name)}</h4><p>${round1(i.amount)} ${i.basis} · ${round1(i.kcal100)} kcal/100${i.basis}</p></div><strong>${Math.round(num(i.kcal100)*num(i.amount)/100)} kcal</strong><button data-remove-ingredient="${idx}">×</button></div>`).join(""):`<div class="empty">Añade los alimentos que has utilizado.</div>`
}
document.addEventListener("click",e=>{const b=e.target.closest("[data-remove-ingredient]");if(b){draftIngredients.splice(num(b.dataset.removeIngredient),1);renderDraftMeal()}const c=e.target.closest("[data-delete-consumption]");if(c){consumption=consumption.filter(x=>x.id!==c.dataset.deleteConsumption);persist();toast("Registro de consumo eliminado")}});
$("#addIngredientBtn").onclick=()=>{
 const candidates=products.filter(p=>num(p.kcal100)>0);
 if(!candidates.length){toast("Primero añade kcal a algún producto");return}
 $("#ingredientProduct").innerHTML=candidates.map(p=>`<option value="${p.id}">${esc(p.name)}${p.brand?" · "+esc(p.brand):""}</option>`).join("");$("#ingredientAmount").value=100;updateIngredientPreview();openModal("ingredientModal")
};
function updateIngredientPreview(){
 const p=products.find(x=>x.id===$("#ingredientProduct").value);if(!p)return;const basis=p.nutritionBasis||"g",amount=Math.max(0,num($("#ingredientAmount").value));$("#ingredientAmountLabel").childNodes[0].nodeValue=`Cantidad usada (${basis}) `;$("#ingredientProductInfo").innerHTML=`<strong>${esc(p.name)}</strong>${round1(p.kcal100)} kcal/100${basis} · P ${round1(p.protein100)} g · H ${round1(p.carbs100)} g · G ${round1(p.fat100)} g`;$("#ingredientKcalPreview").textContent=`${Math.round(num(p.kcal100)*amount/100)} kcal`
}
$("#ingredientProduct").onchange=updateIngredientPreview;$("#ingredientAmount").oninput=updateIngredientPreview;
$("#confirmIngredientBtn").onclick=()=>{
 const p=products.find(x=>x.id===$("#ingredientProduct").value),amount=Math.max(0,num($("#ingredientAmount").value));if(!p||amount<=0){toast("Indica una cantidad válida");return}
 draftIngredients.push({productId:p.id,name:p.name,basis:p.nutritionBasis||"g",amount,kcal100:num(p.kcal100),protein100:num(p.protein100),carbs100:num(p.carbs100),fat100:num(p.fat100)});renderDraftMeal();closeModal("ingredientModal")
};
$("#saveMealBtn").onclick=()=>{
 const name=$("#mealName").value.trim();if(!name){toast("Pon un nombre al plato");return}if(!draftIngredients.length){toast("Añade al menos un alimento");return}
 const totals=mealTotals(draftIngredients);meals.unshift({id:uid(),name,createdAt:nowIso(),ingredients:structuredClone?structuredClone(draftIngredients):JSON.parse(JSON.stringify(draftIngredients)),totals});persist();closeModal("mealModal");go("meals");toast(`${Math.round(totals.kcal)} kcal guardadas`)
};
function openMealDetail(id){
 const m=meals.find(x=>x.id===id);if(!m)return;detailMealId=id;const t=m.totals||mealTotals(m.ingredients||[]);$("#mealDetailName").textContent=m.name;$("#detailKcal").textContent=Math.round(t.kcal);$("#detailProtein").textContent=round1(t.protein);$("#detailCarbs").textContent=round1(t.carbs);$("#detailFat").textContent=round1(t.fat);$("#mealDetailIngredients").innerHTML=(m.ingredients||[]).map(i=>`<div class="ingredient-row"><div><h4>${esc(i.name)}</h4><p>${round1(i.amount)} ${i.basis}</p></div><strong>${Math.round(num(i.kcal100)*num(i.amount)/100)} kcal</strong><span></span></div>`).join("");openModal("mealDetailModal")
}
$("#deleteMealBtn").onclick=()=>{if(!detailMealId)return;if(confirm("¿Eliminar esta comida guardada?")){meals=meals.filter(m=>m.id!==detailMealId);persist();closeModal("mealDetailModal");toast("Comida eliminada")}};

$("#settingsBtn").onclick=()=>openModal("settingsModal");
$("#exportBtn").onclick=()=>{const payload={app:"Mi Despensa",version:3,exportedAt:nowIso(),products,history,meals,consumption};const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`mi-despensa-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);toast("Copia exportada")};
$("#importInput").onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{const data=JSON.parse(await file.text());if(!Array.isArray(data.products))throw new Error();if(confirm(`¿Importar ${data.products.length} productos? Sustituirá los datos actuales.`)){products=data.products;history=Array.isArray(data.history)?data.history:[];meals=Array.isArray(data.meals)?data.meals:[];consumption=Array.isArray(data.consumption)?data.consumption:[];persist();closeModal("settingsModal");toast("Copia restaurada")}}catch{toast("El archivo no es una copia válida")}e.target.value=""};
$("#clearAllBtn").onclick=()=>{if(confirm("¿Borrar inventario, comidas e historial? Esta acción no se puede deshacer.")){products=[];history=[];meals=[];consumption=[];persist();closeModal("settingsModal");toast("Datos eliminados")}};

document.addEventListener("visibilitychange",()=>{if(document.hidden&&scanning)stopScanner()});
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
renderAll();
