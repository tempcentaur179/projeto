import * as THREE from 'three';

const $ = id => document.getElementById(id);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fb9a4);
scene.fog = new THREE.Fog(0x9fb9a4, 18, 42);

const camera = new THREE.PerspectiveCamera(66, innerWidth/innerHeight, .05, 80);
camera.position.set(-7.8, 1.65, 5.6);
camera.rotation.order = 'YXZ';

const renderer = new THREE.WebGLRenderer({antialias:true, powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('app').prepend(renderer.domElement);

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const interactables = [];
const solved = new Set();
const state = {started:false, roof:false, sound:true, demo:false, target:null, selected:null};
const player = {yaw:0, pitch:-.02, speed:3.2};
const velocity = new THREE.Vector3();
const keys = {x:0,z:0};

const mat = (color, rough=.75, metal=0) => new THREE.MeshStandardMaterial({color, roughness:rough, metalness:metal});
const M = {
  wall:mat(0xe7e2d7), floor:mat(0xb7a78e), dark:mat(0x25332b), wood:mat(0x8b6544),
  green:mat(0x6f9d63), light:mat(0xfff0b1), white:mat(0xf3f4ee), black:mat(0x1b211e),
  blue:mat(0x547f9e), red:mat(0xb75a4f), metal:mat(0x6d7470,.35,.65),
  water:mat(0x4fa5d4,.2,.1), solar:mat(0x1f3342,.28,.4), grass:mat(0x6e8d58)
};

function box(name,x,y,z,sx,sy,sz,material=M.white, parent=scene){
  const o=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),material);o.name=name;o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;
}
function cyl(name,x,y,z,r,h,material=M.metal, parent=scene, seg=16){
  const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,seg),material);o.name=name;o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;
}
function textSprite(text,color='#183b27',bg='rgba(240,248,241,.92)'){
  const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d');
  ctx.fillStyle=bg;ctx.roundRect(4,4,504,120,22);ctx.fill();ctx.fillStyle=color;ctx.font='bold 28px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,64);
  const t=new THREE.CanvasTexture(c);const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true}));s.scale.set(2.5,.63,1);return s;
}

const house=new THREE.Group();scene.add(house);
const interior=new THREE.Group();house.add(interior);

// Closed residential structure: no yard/external garden.
box('foundation',0,-.12,0,21,.25,15,M.dark);
box('floor',0,0,0,20,.2,14,M.floor);

// room boundaries/open doorways
const walls=[
  [0,2.5,-7,20,.15,5],[0,2.5,7,20,.15,5],[-10,2.5,0,.15,14,5],[10,2.5,0,.15,14,5],
  [-2,2.5,0,.15,14,5],[3.5,2.5,-3.5,13,.15,5],[3.5,2.5,3.5,13,.15,5],
  [-6,2.5,3.5,8,.15,5],[-6,2.5,-3.5,8,.15,5]
];
walls.forEach((w,i)=>box('wall'+i,w[0],w[1],w[2],w[3],w[4],w[5],M.wall));
box('ceiling',0,5.2,0,20,.15,14,M.wall);

// roof slab + solar panels (roof is a visible inspection mode)
const roof=box('roof',0,5.35,0,21,.35,15,M.dark);
roof.castShadow=true;
for(let i=-3;i<=3;i++) for(let j=-1;j<=1;j++){
  const p=box('solarPanel',i*1.15,5.57,j*1.25,1.02,.08,1.05,M.solar);
  p.rotation.z=.08;p.userData.roof=true;
  interactables.push(p);
}
const sun=new THREE.Mesh(new THREE.SphereGeometry(1.2,16,16),mat(0xffd95e));sun.position.set(12,12,-10);scene.add(sun);

// lighting
scene.add(new THREE.HemisphereLight(0xd8f1ff,0x4d3c2a,1.55));
const moon=new THREE.DirectionalLight(0xfff6df,2.2);moon.position.set(-8,12,8);moon.castShadow=true;moon.shadow.mapSize.set(1024,1024);moon.shadow.camera.left=-20;moon.shadow.camera.right=20;moon.shadow.camera.top=20;moon.shadow.camera.bottom=-20;scene.add(moon);

// room labels
function label(text,x,y,z){const s=textSprite(text);s.position.set(x,y,z);house.add(s);return s}
label('SALA • ENERGIA',-6.5,4.4,-5.9);
label('COZINHA • ALIMENTOS • RECICLAGEM',4.5,4.4,-5.9);
label('BANHEIRO • ÁGUA',-6.3,4.4,5.8);
label('QUARTO • ENERGIA',1.2,4.4,5.8);
label('LAVANDERIA • ÁGUA + ENERGIA',6.4,4.4,5.8);
label('GARAGEM • TRANSPORTE',0,4.4,0.7);

// furniture helpers
function sofa(x,z){
 box('sofa',x,.55,z,3.2,1,1.05,M.green);box('sofaBack',x,1.15,z+.4,3.2,1.3,.35,M.green);
}
function table(x,z){box('tabletop',x,.8,z,2.3,.15,1.25,M.wood);[-.8,.8].forEach(dx=>[-.4,.4].forEach(dz=>box('leg',x+dx,.4,z+dz,.12,.8,.12,M.dark)))}
sofa(-6.8,-4.6);table(-6.7,-2.5);

// TV: screen + glow
const tv=box('tv',-6.8,1.7,-6.15,2.8,1.5,.18,M.black);
const tvScreen=box('tvScreen',-6.8,1.72,-6.25,2.35,1.05,.04,mat(0x2d6d58,.25));
tv.userData={type:'tv'};
tvScreen.userData={type:'tv'};
interactables.push(tv,tvScreen);
const tvStand=box('tvStand',-6.8,.55,-6,3.1,.25,.65,M.wood);

// TV image stripes
for(let i=0;i<3;i++) box('tvGlow',-7.45+i*.65,1.72,-6.28,.5,.8,.02,mat([0x79b7a2,0x9ccf7a,0x4d8e7d][i],.3));

// kitchen counters
box('counter',5.1,1,-6,6.8,1.4,1.2,M.white);box('counter2',8.4,1,-3.9,1.2,1.4,3.2,M.white);
const fridge=box('fridge',8.6,1.75,-5.8,1.15,3.5,.9,M.white);
box('fridgeHandle',8.1,1.8,-5.35,.08,1.5,.08,M.metal);
box('sink',5.4,1.72,-5.95,1.2,.12,.75,M.metal);
cyl('faucet',5.4,2.05,-6.2,.08,.55,M.metal).rotation.x=Math.PI/2;

// food waste group
const foodGroup=new THREE.Group();house.add(foodGroup);
function food(x,z,c){const o=cyl('wastedFood',x,1.78,z,.18,.22,mat(c));o.rotation.z=Math.PI/2;return o}
[food(4.2,-5.8,0x9e6844),food(4.7,-5.75,0x7c994a),food(5.9,-5.75,0x98633e),food(6.5,-5.78,0x687d4a)].forEach(o=>{o.userData={type:'food'};interactables.push(o);foodGroup.add(o)});

// recycling bins
const bins={paper:null,plastic:null,glass:null,metal:null,organic:null};
const binData=[['paper',4.1,-2.3,0xd7e2e8],['plastic',5.1,-2.3,0x6f9dd0],['glass',6.1,-2.3,0x78b68c],['metal',7.1,-2.3,0xc5cbd0],['organic',8.1,-2.3,0xb58a58]];
binData.forEach(([k,x,z,c])=>{const b=box(k,x,.45,z,.8,.9,.8,mat(c));b.userData={type:'bin',category:k};bins[k]=b;interactables.push(b);label(k.toUpperCase(),x,.98,z-0.45)});

// loose recyclable objects
const recycleItems=[
  ['garrafa',3.7,.75,-1.2,0x6b9fbd,'plastic'],['lata',4.7,.72,-1.2,0xbfc6c8,'metal'],
  ['papel',5.7,.73,-1.2,0xe8e1d3,'paper'],['vidro',6.7,.75,-1.2,0x80b89d,'glass'],
  ['casca',7.7,.7,-1.2,0xd28b50,'organic']
];
const itemMap=new Map();
recycleItems.forEach(([n,x,y,z,c,cat])=>{const o=cyl(n,x,y,z,.22,.55,mat(c));o.userData={type:'recycleItem',category:cat,name:n};o.rotation.z=Math.PI/2;interactables.push(o);itemMap.set(n,o)});

// bathroom sink + animated water
const water=new THREE.Group();house.add(water);
const waterStream=cyl('waterStream',-6.5,1.2,5.25,.06,1.7,M.water,water);waterStream.userData={type:'faucet'};
const sinkB=box('bathSink',-6.5,1,5.3,2.4,1.1,1.1,M.white);sinkB.userData={type:'faucet'};interactables.push(sinkB,waterStream);
const tap=cyl('tap',-6.5,1.95,5.0,.07,.7,M.metal);tap.rotation.x=Math.PI/2;
label('TORNEIRA ABERTA',-6.5,2.55,5.25);

// bedroom
const bed=box('bed',1.0,.6,5.2,3.2,.7,5.0,M.white);box('mattress',1,.98,5.0,3,0.3,4.5,M.green);
const lampBase=cyl('lampBase',-1.3,.9,5.0,.28,.15,M.metal);const lamp=box('lamp',-1.3,2.25,5, .65,.85,.65,M.light);lamp.userData={type:'lamp'};interactables.push(lamp);
const bulb=new THREE.PointLight(0xffe8a8,2.5,5);bulb.position.set(-1.3,2.2,5);scene.add(bulb);
const computer=box('computer',1.2,1.5,3.2,1.3,1,.12,M.black);computer.userData={type:'computer'};interactables.push(computer);
const monitorGlow=box('monitorGlow',1.2,1.52,3.12,1,.62,.03,mat(0x5a927b));computer.add(monitorGlow);
const charger=box('charger',-1.0,.8,3.2,.35,.25,.45,M.white);charger.userData={type:'charger'};interactables.push(charger);
box('chargingCable',-.75,.82,3.2,1.2,.05,.05,M.black);

// laundry
box('washer',7.2,1.25,4.9,1.7,2.5,1.7,M.white);const washerDoor=cyl('washerDoor',7.2,1.25,4.02,.55,.08,M.black);washerDoor.rotation.x=Math.PI/2;
const washerRing=cyl('washerRing',7.2,1.25,3.96,.42,.1,M.water);washerRing.rotation.x=Math.PI/2;
const clothes=box('fewClothes',7.2,2.75,4.9,1.1,.18,.7,mat(0x5b7185));clothes.userData={type:'laundry'};interactables.push(clothes);
const laundryTap=box('laundryTap',8.7,1.8,5.3,.18,.55,.18,M.metal);laundryTap.userData={type:'laundryTap'};interactables.push(laundryTap);
const laundryWater=cyl('laundryWater',8.7,1.25,5.3,.055,1.2,M.water);laundryWater.userData={type:'laundryTap'};interactables.push(laundryWater);

// garage: car combustion
const car=new THREE.Group();house.add(car);car.position.set(-4,0,1.0);
box('carBody',0,1.0,0,5.2,1.1,2.5,M.red,car);
box('carHood',1.8,1.45,0,1.6,.45,2.3,M.red,car);
box('carCabin',-.5,1.75,0,2.2,1.1,2.15,mat(0x28383b,.25),car);
for(const x of [-1.7,1.6])for(const z of [-1.15,1.15])cyl('wheel',x,.55,z,.5,.35,M.black,car,20).rotation.x=Math.PI/2;
box('exhaust',2.65,.8,.7,.45,.18,.18,M.metal,car);
car.userData={type:'car'};interactables.push(car);
label('CARRO A COMBUSTÃO',-4,3.2,1.0);

// bicycle
const bike=new THREE.Group();bike.position.set(2.8,.1,-.1);house.add(bike);
for(const z of [-.65,.65]){const w=new THREE.Mesh(new THREE.TorusGeometry(.55,.08,10,20),M.black);w.position.set(0,.7,z);w.rotation.y=Math.PI/2;bike.add(w)}
box('bikeFrame',0,.85,0,1.2,.12,.12,M.green,bike);box('bikeBar',.45,1.1,0,.1,.65,.1,M.green,bike);
bike.userData={type:'bike'};interactables.push(bike);

// doors visually
for(const [x,z,w,d] of [[-2,-3.5,1.8,.15],[-2,3.5,1.8,.15],[3.5,0,.15,1.8]])box('door',x,1.5,z,w,3,.12,M.wood);

// sign
label('IDENTIFIQUE OS PONTOS DE DESPERDÍCIO',0,3.7,0);

// state visuals
function setVisible(obj,v){obj.visible=v}
function applyVisual(type, solvedState){
  if(type==='tv'){tvScreen.material.color.set(solvedState?0x101513:0x2d6d58);tvScreen.material.emissive?.set?.(solvedState?0x000000:0x1d4a3b);}
  if(type==='faucet'){water.visible=!solvedState}
  if(type==='lamp'){lamp.material.color.set(solvedState?0x555b55:0xfff0b1);bulb.intensity=solvedState?0:2.5}
  if(type==='computer'){monitorGlow.visible=!solvedState}
  if(type==='charger'){charger.material.color.set(solvedState?0x555b55:0xf3f4ee)}
  if(type==='food'){foodGroup.visible=!solvedState}
  if(type==='laundry'){clothes.scale.setScalar(solvedState?1.5:1)}
  if(type==='laundryTap'){laundryWater.visible=!solvedState}
}
function score(){return solved.size*10}
function updateScore(){
  const n=score();$('scoreValue').textContent=n+'%';$('progressBar').style.width=n+'%';
  if(n>=100) setTimeout(()=>{$('endScreen').style.display='grid'},700);
}
function markSolved(type){
  if(solved.has(type)) return;
  solved.add(type); applyVisual(type,true); updateScore();
  const messages={
    tv:'Solução aplicada! Um consumo desnecessário foi evitado.',
    faucet:'Solução aplicada! A água deixou de correr sem necessidade.',
    food:'Solução aplicada! Planejar e armazenar corretamente ajuda a reduzir desperdícios.',
    lamp:'Solução aplicada! A iluminação desnecessária foi desligada.',
    computer:'Solução aplicada! O computador não ficou consumindo energia sem uso.',
    charger:'Solução aplicada! O carregador foi desconectado.',
    laundry:'Solução aplicada! A lavagem foi otimizada.',
    laundryTap:'Solução aplicada! A torneira da lavanderia foi fechada.',
    transport:'Alternativa apresentada. Diferentes formas de transporte têm diferentes impactos.',
    solar:'Você conheceu uma fonte renovável de geração de eletricidade.',
    recycling:'Separação correta! O resíduo foi encaminhado para a categoria correspondente.'
  };
  toast(messages[type]||'Solução aplicada!');
}

function modal(data){
  $('modalIcon').textContent=data.icon||'⚠️';$('modalTag').textContent=data.tag||'PONTO EDUCATIVO';$('modalTitle').textContent=data.title;
  $('modalBody').innerHTML=data.body||'';$('modalAction').innerHTML=data.action||'';$('modal').classList.add('open');
}
function closeModal(){$('modal').classList.remove('open')}
$('modalClose').onclick=closeModal;

function interact(type,obj){
  if(type==='tv') modal({icon:'⚠️',tag:'DESPERDÍCIO DE ENERGIA',title:'Televisão ligada sem ninguém utilizando',body:'<p>Manter aparelhos eletrônicos ligados sem necessidade gera consumo desnecessário de energia.</p><div class="solution"><b>SOLUÇÃO</b><br>Desligar a TV quando ninguém estiver assistindo.</div>',action:`<button class="action" data-solve="tv">${solved.has('tv')?'TV JÁ DESLIGADA':'DESLIGAR TV'}</button>`});
  else if(type==='faucet') modal({icon:'💧',tag:'DESPERDÍCIO DE ÁGUA',title:'Torneira aberta sem utilização',body:'<p>Deixar a torneira aberta sem necessidade desperdiça água.</p><div class="solution"><b>SOLUÇÃO</b><br>Fechar a torneira quando a água não estiver sendo usada.</div>',action:`<button class="action" data-solve="faucet">${solved.has('faucet')?'TORNEIRA FECHADA':'FECHAR TORNEIRA'}</button>`});
  else if(type==='food') modal({icon:'🥕',tag:'DESPERDÍCIO DE ALIMENTOS',title:'Alimentos desperdiçados',body:'<p>Alimentos desperdiçados representam também desperdício de água, energia, transporte, trabalho e outros recursos usados na produção.</p><div class="solution"><b>SOLUÇÃO</b><br>Planejar compras e armazenar corretamente os alimentos ajuda a reduzir desperdícios.</div>',action:`<button class="action" data-solve="food">${solved.has('food')?'ALIMENTOS ORGANIZADOS':'ORGANIZAR ALIMENTOS'}</button>`});
  else if(type==='lamp') modal({icon:'💡',tag:'DESPERDÍCIO DE ENERGIA',title:'Luz acesa sem necessidade',body:'<p>Uma lâmpada ligada em um ambiente sem uso representa consumo desnecessário.</p>',action:`<button class="action" data-solve="lamp">${solved.has('lamp')?'LUZ APAGADA':'APAGAR LUZ'}</button>`});
  else if(type==='computer') modal({icon:'💻',tag:'DESPERDÍCIO DE ENERGIA',title:'Computador ligado sem utilização',body:'<p>Equipamentos ligados sem necessidade continuam consumindo energia.</p>',action:`<button class="action" data-solve="computer">${solved.has('computer')?'COMPUTADOR DESLIGADO':'DESLIGAR COMPUTADOR'}</button>`});
  else if(type==='charger') modal({icon:'🔌',tag:'DESPERDÍCIO DE ENERGIA',title:'Carregador conectado sem necessidade',body:'<p>Quando não está sendo utilizado, desconectar o carregador evita consumo e mantém a rotina mais eficiente.</p>',action:`<button class="action" data-solve="charger">${solved.has('charger')?'DESCONECTADO':'DESCONECTAR'}</button>`});
  else if(type==='laundry') modal({icon:'🧺',tag:'USO INEFICIENTE',title:'Máquina com pouca quantidade de roupas',body:'<p>Utilizar a máquina com pouca quantidade de roupas pode aumentar a necessidade de ciclos de lavagem.</p><div class="solution"><b>SOLUÇÃO</b><br>Quando adequado, reunir roupas compatíveis e usar a máquina de forma planejada.</div>',action:`<button class="action" data-solve="laundry">${solved.has('laundry')?'LAVAGEM OTIMIZADA':'OTIMIZAR LAVAGEM'}</button>`});
  else if(type==='laundryTap') modal({icon:'💧',tag:'CONSUMO DE ÁGUA',title:'Torneira da lavanderia',body:'<p>Fechar a torneira quando ela não estiver sendo utilizada ajuda a evitar desperdício.</p>',action:`<button class="action" data-solve="laundryTap">${solved.has('laundryTap')?'TORNEIRA FECHADA':'FECHAR TORNEIRA'}</button>`});
  else if(type==='car') modal({icon:'🚗',tag:'TRANSPORTE E SUSTENTABILIDADE',title:'Problema identificado',body:'<p>Este veículo utiliza um motor a combustão.</p><p>Veículos com motores a combustão utilizam combustíveis que liberam gases e outros poluentes durante seu funcionamento. O impacto ambiental depende do combustível, do veículo e de como ele é utilizado.</p><div class="solution"><b>POSSÍVEL SOLUÇÃO</b><br>Utilizar alternativas de menor emissão quando forem adequadas à situação, como veículos elétricos, transporte público, bicicleta, caminhada ou caronas.</div><div class="compare"><div><b>🚗 Combustão</b>Combustível → motor a combustão → gases pelo escapamento</div><div><b>⚡ Elétrico</b>Eletricidade → motor elétrico → sem gases pelo escapamento durante o uso</div></div>',action:`<button class="action" data-solve="transport">VER ALTERNATIVA SUSTENTÁVEL</button>`});
  else if(type==='bike') modal({icon:'🚲',tag:'MOBILIDADE SUSTENTÁVEL',title:'Bicicleta',body:'<p>Para trajetos adequados, caminhar ou utilizar bicicleta pode reduzir o consumo de combustíveis e as emissões associadas ao transporte.</p>',action:'<button class="secondary" onclick="document.getElementById(\'modal\').classList.remove(\'open\')">CONTINUAR EXPLORANDO</button>'});
  else if(type==='solar') modal({icon:'☀️',tag:'ENERGIA SOLAR',title:'Energia solar',body:'<p>Painéis solares podem transformar a energia da luz do Sol em eletricidade.</p><div class="compare"><div><b>☀️ SOL</b>luz solar</div><div><b>⬇️ PAINÉIS</b>conversão de energia</div><div><b>⚡ ELETRICIDADE</b>energia elétrica</div><div><b>🏠 CASA</b>distribuição</div></div>',action:`<button class="action" data-solve="solar">${solved.has('solar')?'ENERGIA SOLAR VISTA':'MARCAR COMO CONHECIDO'}</button>`});
  else if(type==='recycleItem'){
    const cat=obj.userData.category;
    modal({icon:'♻️',tag:'RECICLAGEM',title:'Para onde vai este objeto?',body:`<p>Escolha a lixeira correspondente ao objeto: <b>${obj.userData.name}</b>.</p>`,action:`<div class="compare">${['paper','plastic','glass','metal','organic'].map(k=>`<button class="secondary" style="margin:0" data-bin="${k}">${k.toUpperCase()}</button>`).join('')}</div>`});
    document.querySelectorAll('[data-bin]').forEach(b=>b.onclick=()=>{if(b.dataset.bin===cat){closeModal();obj.visible=false;markSolved('recycling')}else toast('Essa não é a categoria adequada. Tente novamente.')});
  }
}

$('modalAction').addEventListener('click',e=>{
  const b=e.target.closest('[data-solve]'); if(!b)return;
  const type=b.dataset.solve;
  if(type==='transport'){
    car.visible=false;
    const electric=car.clone(true);electric.position.set(-4,0,1);electric.traverse(o=>{if(o.isMesh)o.material=o.material.clone();if(o.isMesh&&o.name==='carBody')o.material.color.set(0x4b9b78)});electric.userData={type:'electricCar'};house.add(electric);
    b.textContent='ALTERNATIVA VISUALIZADA';markSolved('transport');return;
  }
  markSolved(type);closeModal();
});

function toast(t){$('toast').textContent=t;$('toast').classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>$('toast').classList.remove('show'),2200)}

function reset(){
  solved.clear();state.roof=false;car.visible=true;
  house.traverse(o=>{if(o.userData?.type==='electricCar')o.visible=false});
  ['tv','faucet','food','lamp','computer','charger','laundry','laundryTap'].forEach(t=>applyVisual(t,false));
  interactables.forEach(o=>{if(o.userData?.type==='recycleItem')o.visible=true});
  updateScore();$('endScreen').style.display='none';toast('Casa reiniciada.');
}
$('resetBtn').onclick=()=>{closePanels();reset()};
$('againBtn').onclick=()=>{reset();$('endScreen').style.display='none'};
function closePanels(){document.querySelectorAll('.panel').forEach(p=>p.classList.remove('open'))}
$('menuBtn').onclick=()=>{$('menu').classList.toggle('open');$('map').classList.remove('open')};
$('mapBtn').onclick=()=>{$('map').classList.add('open');$('menu').classList.remove('open')};
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).classList.remove('open'));
document.querySelectorAll('.map-room').forEach(r=>r.onclick=()=>{closePanels();const p={sala:[-6.8,1.65,-4],cozinha:[6,1.65,-4],banheiro:[-6.5,1.65,4],quarto:[0,1.65,5],lavanderia:[7,1.65,4],garagem:[-4,1.65,1]}[r.dataset.room];camera.position.set(...p);});
$('soundBtn').onclick=()=>{state.sound=!state.sound;$('soundBtn').textContent=state.sound?'🔊 SOM: ATIVADO':'🔇 SOM: DESATIVADO'};
$('roofBtn').onclick=()=>{closePanels();state.roof=true;$('roofMode').style.display='block';camera.position.set(0,10.5,13);camera.lookAt(0,5.3,0)};
$('roofBack').onclick=()=>{state.roof=false;$('roofMode').style.display='none';camera.position.set(-7.8,1.65,5.6)};

$('enterBtn').onclick=()=>{state.started=true;$('intro').style.display='none';$('app').style.opacity=1;$('app').setAttribute('aria-hidden','false');toast('Explore a casa e toque nos pontos interativos.')};

// joystick touch
let joyId=null, joyCenter={x:0,y:0};
const joy=$('joystick'),knob=$('joyKnob');
function joyStart(e){if(joyId!==null)return;const t=e.changedTouches[0];joyId=t.identifier;const r=joy.getBoundingClientRect();joyCenter={x:r.left+r.width/2,y:r.top+r.height/2};joyMove(e)}
function joyMove(e){for(const t of e.changedTouches){if(t.identifier!==joyId)continue;let dx=t.clientX-joyCenter.x,dy=t.clientY-joyCenter.y;const max=48;const len=Math.hypot(dx,dy);if(len>max){dx*=max/len;dy*=max/len}knob.style.transform=`translate(${dx}px,${dy}px)`;keys.x=dx/max;keys.z=dy/max}}
function joyEnd(e){for(const t of e.changedTouches){if(t.identifier===joyId){joyId=null;keys.x=keys.z=0;knob.style.transform='translate(0,0)'}}}
joy.addEventListener('touchstart',joyStart,{passive:false});joy.addEventListener('touchmove',joyMove,{passive:false});joy.addEventListener('touchend',joyEnd,{passive:false});joy.addEventListener('touchcancel',joyEnd,{passive:false});

// camera look: touch anywhere except controls
let lookId=null,lastX=0,lastY=0;
renderer.domElement.addEventListener('touchstart',e=>{for(const t of e.changedTouches){if(lookId===null){lookId=t.identifier;lastX=t.clientX;lastY=t.clientY}}},{passive:false});
renderer.domElement.addEventListener('touchmove',e=>{if(lookId===null)return;for(const t of e.changedTouches)if(t.identifier===lookId){const dx=t.clientX-lastX,dy=t.clientY-lastY;lastX=t.clientX;lastY=t.clientY;player.yaw-=dx*.004;player.pitch-=dy*.003;player.pitch=Math.max(-1.15,Math.min(.8,player.pitch));camera.rotation.set(player.pitch,player.yaw,0)}},{passive:false});
renderer.domElement.addEventListener('touchend',e=>{for(const t of e.changedTouches)if(t.identifier===lookId)lookId=null},{passive:false});

// interaction raycast
function tapAt(clientX,clientY){
  pointer.x=(clientX/innerWidth)*2-1;pointer.y=-(clientY/innerHeight)*2+1;raycaster.setFromCamera(pointer,camera);
  const hits=raycaster.intersectObjects(interactables,true);
  if(hits.length){
    let o=hits[0].object;while(o.parent&&!o.userData?.type)o=o.parent;
    if(o.userData?.type){state.selected=o;interact(o.userData.type,o)}
  }
}
renderer.domElement.addEventListener('touchend',e=>{
  if(lookId!==null)return;
  const t=e.changedTouches[0];tapAt(t.clientX,t.clientY);
},{passive:false});
$('interactBtn').onclick=()=>{if(state.target)interact(state.target.userData.type,state.target)};

// detect nearest interactable
function nearest(){
  let best=null,bd=2.35;
  for(const o of interactables){
    if(!o.visible||!o.userData?.type||o.userData.type==='solar')continue;
    const p=new THREE.Vector3();o.getWorldPosition(p);const d=p.distanceTo(camera.position);
    if(d<bd){bd=d;best=o}
  }
  state.target=best;
  $('interactBtn').classList.toggle('show',!!best);$('hint').classList.toggle('show',!!best);
  if(best)$('hint').textContent=best.userData.type==='recycleItem'?'TOQUE PARA SEPARAR O RESÍDUO':'TOQUE PARA INTERAGIR';
}

// simple collision against outer and partition walls; keeps user inside house.
function move(dt){
  const f=new THREE.Vector3(-Math.sin(player.yaw),0,-Math.cos(player.yaw));
  const r=new THREE.Vector3(Math.cos(player.yaw),0,-Math.sin(player.yaw));
  velocity.set(0,0,0).addScaledVector(r,keys.x).addScaledVector(f,-keys.z);
  if(velocity.lengthSq()>1)velocity.normalize();
  const next=camera.position.clone().addScaledVector(velocity,player.speed*dt);
  next.x=THREE.MathUtils.clamp(next.x,-9.2,9.2);next.z=THREE.MathUtils.clamp(next.z,-6.2,6.2);
  // soft wall constraints / room partitions
  if(Math.abs(next.x+2)<.22 && Math.abs(next.z)>3.55) next.x=camera.position.x;
  if(Math.abs(next.z+3.5)<.22 && next.x>3.5) next.z=camera.position.z;
  if(Math.abs(next.z-3.5)<.22 && next.x>3.5) next.z=camera.position.z;
  camera.position.copy(next);camera.position.y=1.65;
}

// demo route: camera moves through predefined stops and opens educational panels
const demoStops=[
  {p:[-6.8,1.65,-4.2],type:'tv',text:'Sala: identifique a TV ligada.'},
  {p:[-6.5,1.65,4.1],type:'faucet',text:'Banheiro: identifique o desperdício de água.'},
  {p:[5.2,1.65,-4.4],type:'food',text:'Cozinha: observe o desperdício de alimentos.'},
  {p:[0,1.65,5],type:'lamp',text:'Quarto: observe o consumo de energia.'},
  {p:[7.1,1.65,4.1],type:'laundry',text:'Lavanderia: observe o uso da máquina.'},
  {p:[-4,1.65,1],type:'car',text:'Garagem: compare formas de transporte.'},
  {p:[0,10.5,13],type:'solar',text:'Telhado: conheça a energia solar.'}
];
let demoIndex=0,demoTimer=0;
$('demoBtn').onclick=()=>{closePanels();state.demo=true;demoIndex=0;demoTimer=0;$('demoBar').style.display='flex';toast('Modo demonstração iniciado.');};
$('demoStop').onclick=()=>{state.demo=false;$('demoBar').style.display='none'};
function runDemo(dt){
  if(!state.demo)return;
  const s=demoStops[demoIndex];const target=new THREE.Vector3(...s.p);
  camera.position.lerp(target,Math.min(1,dt*1.8));$('demoText').textContent=s.text;
  demoTimer+=dt;
  if(demoTimer>2.2){demoTimer=0;if(s.type==='solar'){state.roof=true;$('roofMode').style.display='block'}else{const o=interactables.find(x=>x.userData?.type===s.type);if(o)interact(s.type,o)}demoIndex=(demoIndex+1)%demoStops.length}
}

// initial visual states
reset();

function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.6))}
addEventListener('resize',resize);addEventListener('orientationchange',()=>setTimeout(resize,250));

function animate(){
 requestAnimationFrame(animate);
 const dt=Math.min(clock.getDelta(),.05);
 if(state.started&&!state.roof&&!state.demo)move(dt);
 if(state.started&&state.demo)runDemo(dt);
 if(state.started&&!state.roof)nearest();
 renderer.render(scene,camera);
}
animate();
setTimeout(()=>$('loading').style.display='none',700);
