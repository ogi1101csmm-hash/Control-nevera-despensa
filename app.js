
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

function productCard(p){
 const cls=p.qty===0?"zero":p.qty<=p.minStock?"low":"";
 const nutrition=p.kcal100?` · ${round1(p.kcal100)} kcal/100${p.nutritionBasis||"g"}`:"";
 return `<article class="product-card" data-product="${p.id}"><img class="product-thumb" src="${esc(p.image||defaultImage())}" alt=""><div><h3>${esc(p.name||"Producto sin nombre")}</h3><p>${esc(p.brand||"")} ${p.brand?"·":""} ${locationText(p.location)}${nutrition}${p.expiry?" · cad. "+new Date(p.expiry+"T12:00").toLocaleDateString("es-ES",{day:"2-digit",month:"short"}):""}</p></div><div class="qty-pill ${cls}">${p.qty}</div></article>`
}
function mealTotals(ingredients){
 return ingredients.reduce((a,i)=>{
   const f=num(i.amount)/100;
   a.kcal+=num(i.kcal100)*f;a.protein+=num(i.protein100)*f;a.carbs+=num(i.carbs100)*f;a.fat+=num(i.fat100)*f;return a
 },{kcal:0,protein:0,carbs:0,fat:0})
}
function renderAll(){
 const total=products.reduce((a,p)=>a+num(p.qty),0),fridge=products.filter(p=>p.location==="fridge").reduce((a,p)=>a+num(p.qty),0),pantry=products.filter(p=>p.location==="pantry").reduce((a,p)=>a+num(p.qty),0);
 $("#totalUnits").textContent=total;$("#fridgeUnits").textContent=fridge;$("#pantryUnits").textContent=pantry;$("#totalProductsText").textContent=`${products.length} producto${products.length===1?"":"s"} distintos`;
 const attention=[],today=new Date();today.setHours(0,0,0,0);
 products.forEach(p=>{if(p.qty<=p.minStock)attention.push({p,type:p.qty===0?"danger":"",text:p.qty===0?"Sin stock":`Stock bajo: ${p.qty} ud.`});if(p.expiry){const exp=new Date(p.expiry+"T00:00:00"),days=Math.ceil((exp-today)/86400000);if(days<=3)attention.push({p,type:days<0?"danger":"",text:days<0?"Caducado":days===0?"Caduca hoy":`Caduca en ${days} día${days===1?"":"s"}`})}});
 $("#attentionList").innerHTML=attention.length?attention.slice(0,6).map(a=>`<div class="attention-card ${a.type}" data-product="${a.p.id}"><span class="alert-dot"></span><div><strong>${esc(a.p.name)}</strong><small>${a.text}</small></div></div>`).join(""):`<div class="empty">Todo está bajo control.</div>`;
 const recent=[...products].sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt)).slice(0,5);$("#recentList").innerHTML=recent.length?recent.map(productCard).join(""):`<div class="empty">Escanea tu primer producto para empezar.</div>`;
 const q=$("#searchInput")?.value?.trim().toLowerCase()||"";let list=products.filter(p=>currentFilter==="all"||p.location===currentFilter);if(q)list=list.filter(p=>[p.name,p.brand,p.barcode].some(x=>(x||"").toLowerCase().includes(q)));list.sort((a,b)=>a.name.localeCompare(b.name,"es"));$("#inventoryList").innerHTML=list.length?list.map(productCard).join(""):`<div class="empty">No hay productos con este filtro.</div>`;
 $("#historyList").innerHTML=history.length?history.slice(0,120).map(h=>`<div class="history-card"><div class="history-icon">${h.delta>0?"+":"−"}</div><div><p>${esc(h.name)}</p><small>${h.reason} · ${fmtDate(h.at)}</small></div><div class="history-delta ${h.delta>0?"plus":"minus"}">${h.delta>0?"+":""}${h.delta}</div></div>`).join(""):`<div class="empty">Todavía no hay movimientos.</div>`;
 const todayConsumption=consumption.filter(c=>c.date===dayKey());
 const dayTotals=todayConsumption.reduce((a,c)=>{a.kcal+=num(c.calories);a.protein+=num(c.protein);a.carbs+=num(c.carbs);a.fat+=num(c.fat);return a},{kcal:0,protein:0,carbs:0,fat:0});
 $("#todayConsumedKcal").textContent=Math.round(dayTotals.kcal);$("#todayConsumedItems").textContent=todayConsumption.length;$("#todayConsumedProtein").textContent=round1(dayTotals.protein);$("#todayConsumedCarbs").textContent=round1(dayTotals.carbs);$("#todayConsumedFat").textContent=round1(dayTotals.fat);
 $("#todayConsumptionList").innerHTML=todayConsumption.length?todayConsumption.map(c=>`<article class="consumption-card"><div><h3>${esc(c.name)}</h3><p>${esc(c.meal)} · ${round1(c.amount)} ${c.basis} · ${c.stockUnits} ud. retiradas</p></div><div><strong>${Math.round(c.calories)} kcal</strong><button data-delete-consumption="${c.id}" aria-label="Eliminar registro">×</button></div></article>`).join(""):`<div class="empty">Cuando pulses Consumir en un producto aparecerá aquí.</div>`;
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
 if(editingId){const idx=products.findIndex(p=>p.id===editingId),old=products[idx];if(old&&old.qty!==data.qty)addHistory({...old,...data},data.qty-old.qty,"Ajuste manual");products[idx]={...old,...data}}
 else{const same=data.barcode&&products.find(p=>p.barcode===data.barcode);if(same){same.qty+=data.qty;same.updatedAt=nowIso();addHistory(same,data.qty,"Entrada");toast(`Añadidas ${data.qty} ud.`)}else{const p={id:uid(),createdAt:nowIso(),...data};products.push(p);addHistory(p,p.qty,"Alta inicial")}}
 persist();closeModal("productModal")
};
$("#deleteProductBtn").onclick=()=>{if(!editingId)return;if(confirm("¿Eliminar este producto del inventario?")){products=products.filter(p=>p.id!==editingId);persist();closeModal("productModal");toast("Producto eliminado")}};

function openStock(id){const p=products.find(x=>x.id===id);if(!p)return;stockId=id;$("#stockProductName").textContent=p.name;$("#stockCurrent").textContent=p.qty;$("#moveQty").value=1;openModal("stockModal")}
$("#moveQtyMinus").onclick=()=>$("#moveQty").value=Math.max(1,num($("#moveQty").value)-1);$("#moveQtyPlus").onclick=()=>$("#moveQty").value=Math.max(1,num($("#moveQty").value)+1);
$("#addStockBtn").onclick=()=>{const p=products.find(x=>x.id===stockId);if(!p)return;const amount=Math.max(1,num($("#moveQty").value));p.qty+=amount;p.updatedAt=nowIso();addHistory(p,amount,"Entrada");$("#stockCurrent").textContent=p.qty;$("#moveQty").value=1;persist();toast(`Añadidas ${amount} ud.`)};
function openConsume(){const p=products.find(x=>x.id===stockId);if(!p)return;const units=Math.min(Math.max(1,num($("#moveQty").value)),p.qty);if(p.qty<=0){toast("No queda stock");return}$("#consumeProductName").textContent=p.name;$("#consumeUnitsLabel").textContent=units;const basis=p.nutritionBasis||p.unitMeasure||"g";$("#consumeAmountLabel").childNodes[0].nodeValue=`Cantidad realmente consumida (${basis}) `;const autoAmount=num(p.unitAmount)>0?round1(num(p.unitAmount)*units):"";$("#consumeAmount").value=autoAmount;$("#consumeMeal").value="Comida";updateConsumePreview();closeModal("stockModal");openModal("consumeModal")}
$("#consumeStockBtn").onclick=openConsume;
$("#consumeAmount").oninput=updateConsumePreview;
function updateConsumePreview(){const p=products.find(x=>x.id===stockId);if(!p)return;const amount=Math.max(0,num($("#consumeAmount").value)),factor=amount/100;$("#consumeKcalPreview").textContent=Math.round(num(p.kcal100)*factor);$("#consumeProteinPreview").textContent=round1(num(p.protein100)*factor);$("#consumeCarbsPreview").textContent=round1(num(p.carbs100)*factor);$("#consumeFatPreview").textContent=round1(num(p.fat100)*factor);const warning=$("#consumeWarning");if(!num(p.kcal100)){warning.textContent="Este producto no tiene calorías guardadas. Puedes consumirlo, pero no será posible sumar kcal hasta completar su ficha nutricional.";warning.classList.remove("hidden")}else if(!amount){warning.textContent="Indica los gramos/ml consumidos para calcular las calorías.";warning.classList.remove("hidden")}else{warning.classList.add("hidden")}}
$("#confirmConsumeBtn").onclick=()=>{const p=products.find(x=>x.id===stockId);if(!p)return;const units=Math.min(Math.max(1,num($("#consumeUnitsLabel").textContent)),p.qty),amount=Math.max(0,num($("#consumeAmount").value)),basis=p.nutritionBasis||p.unitMeasure||"g";if(num(p.kcal100)>0&&amount<=0){toast("Indica la cantidad consumida");return}const factor=amount/100,entry={id:uid(),productId:p.id,name:p.name,date:dayKey(),at:nowIso(),meal:$("#consumeMeal").value,stockUnits:units,amount,basis,calories:num(p.kcal100)*factor,protein:num(p.protein100)*factor,carbs:num(p.carbs100)*factor,fat:num(p.fat100)*factor};p.qty=Math.max(0,p.qty-units);p.updatedAt=nowIso();consumption.unshift(entry);addHistory(p,-units,"Consumo");persist();closeModal("consumeModal");toast(`${units} ud. consumidas · ${Math.round(entry.calories)} kcal registradas`)};
$("#discardProductBtn").onclick=()=>{const p=products.find(x=>x.id===stockId);if(!p)return;const units=Math.min(Math.max(1,num($("#moveQty").value)),p.qty);if(units<=0){toast("No queda stock");return}if(confirm(`¿Eliminar ${units} ud. de ${p.name} por caducidad, mal estado o descarte? No se registrarán calorías.`)){p.qty=Math.max(0,p.qty-units);p.updatedAt=nowIso();addHistory(p,-units,"Descarte");$("#stockCurrent").textContent=p.qty;$("#moveQty").value=1;persist();toast(`${units} ud. descartadas · 0 kcal`)}};
$("#editFromStockBtn").onclick=()=>{const p=products.find(x=>x.id===stockId);closeModal("stockModal");openEditor(p)};
function addHistory(p,delta,reason){if(!delta)return;history.unshift({id:uid(),productId:p.id,name:p.name,delta,reason,at:nowIso()})}

async function fetchProduct(barcode){
 const clean=barcode.replace(/\D/g,"");if(!clean){toast("Código no válido");return}const existing=products.find(p=>p.barcode===clean);if(existing){await stopScanner();closeModal("scannerModal");openStock(existing.id);toast("Producto ya registrado");return}
 toast("Buscando producto…");
 try{
  const fields="product_name,product_name_es,brands,image_front_small_url,image_front_url,nutriments,serving_quantity,serving_quantity_unit,product_quantity,product_quantity_unit";
  const r=await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(clean)}?fields=${fields}`),data=await r.json();await stopScanner();closeModal("scannerModal");resetEditor();$("#productBarcode").value=clean;
  if(data.status===1&&data.product){
    const p=data.product,n=p.nutriments||{};$("#productName").value=p.product_name_es||p.product_name||"";$("#productBrand").value=p.brands||"";$("#productImage").src=p.image_front_small_url||p.image_front_url||defaultImage();$("#productModalTitle").textContent=p.product_name_es||p.product_name||"Nuevo producto";
    const kcal=n["energy-kcal_100g"]??(n["energy-kj_100g"]?num(n["energy-kj_100g"])/4.184:null);$("#productKcal100").value=kcal?round1(kcal):"";$("#productProtein100").value=n.proteins_100g??"";$("#productCarbs100").value=n.carbohydrates_100g??"";$("#productFat100").value=n.fat_100g??"";
    const unit=(p.product_quantity_unit||p.serving_quantity_unit||"g").toLowerCase();const basis=unit==="ml"?"ml":"g";$("#productNutritionBasis").value=basis;$("#productUnitMeasure").value=basis;$("#productUnitAmount").value=num(p.product_quantity)||num(p.serving_quantity)||"";$("#nutritionSource").textContent="Open Food Facts";toast(kcal?"Producto y nutrición encontrados":"Producto encontrado · faltan kcal")
  }else{$("#productModalTitle").textContent="Producto no encontrado";toast("Completa los datos manualmente")}
  openModal("productModal")
 }catch(err){await stopScanner();closeModal("scannerModal");resetEditor();$("#productBarcode").value=clean;openModal("productModal");toast("Sin datos online. Añádelo manualmente")}
}
async function openScanner(){openModal("scannerModal");$("#manualBarcode").value="";setTimeout(startScanner,120)}
$("#scanFab").onclick=openScanner;$("#quickScanBtn").onclick=openScanner;$("#manualBarcodeBtn").onclick=()=>fetchProduct($("#manualBarcode").value);$("#manualBarcode").addEventListener("keydown",e=>{if(e.key==="Enter")fetchProduct(e.target.value)});
async function startScanner(){if(scanning)return;if(typeof Html5Qrcode==="undefined"){$("#reader").innerHTML=`<div class="empty" style="margin:30px">No se pudo cargar el lector. Usa el código manual.</div>`;return}try{scanner=new Html5Qrcode("reader",{formatsToSupport:[Html5QrcodeSupportedFormats.EAN_13,Html5QrcodeSupportedFormats.EAN_8,Html5QrcodeSupportedFormats.UPC_A,Html5QrcodeSupportedFormats.UPC_E,Html5QrcodeSupportedFormats.CODE_128],useBarCodeDetectorIfSupported:true});scanning=true;await scanner.start({facingMode:"environment"},{fps:10,qrbox:(w,h)=>({width:Math.min(w*.88,330),height:Math.min(h*.34,130)}),aspectRatio:1.777},async decoded=>{if(scanning){scanning=false;try{await scanner.stop()}catch{}await fetchProduct(decoded)}},()=>{})}catch(e){scanning=false;$("#reader").innerHTML=`<div class="empty" style="margin:30px">No se ha podido abrir la cámara. Comprueba el permiso o introduce el código manualmente.</div>`}}
async function stopScanner(){if(scanner){try{if(scanner.isScanning)await scanner.stop()}catch{}try{scanner.clear()}catch{}}scanner=null;scanning=false;const r=$("#reader");if(r)r.innerHTML=""}

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
