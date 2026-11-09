import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
(()=> {
const $=id=>document.getElementById(id);
let me=null,dest=null,route=null,steps=[],stepIndex=0,watchId=null,userMarker=null,destMarker=null,voiceOn=true,routeBusy=false,gpsBusy=false,lastReroute=0,is3D=true,mapReady=false,lastCameraAt=0,lastCameraBearing=null;
const map=new maplibregl.Map({container:'map',style:'https://tiles.openfreemap.org/styles/bright',center:[100.5342,13.7456],zoom:15.5,pitch:62,bearing:-18,antialias:true});
map.addControl(new maplibregl.NavigationControl({showCompass:false,showZoom:false}),'top-right');
function say(t){if(voiceOn&&'speechSynthesis'in window){speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(t);u.lang='th-TH';u.rate=1;speechSynthesis.speak(u)}}
function notice(t){$('notice').textContent=t;$('notice').style.display='block';clearTimeout(notice.timer);notice.timer=setTimeout(()=>$('notice').style.display='none',3500)}
function markerEl(txt,cls){const e=document.createElement('div');e.className=cls||'';e.textContent=txt;return e}
const landmarkData=[
 {name:'ตึกช้าง',coords:[100.56861,13.82528],icon:'🐘',kind:'elephant'},
 {name:'ใบหยก 2',coords:[100.540556,13.754167],icon:'🏙️',kind:'tower'},
 {name:'สถานีกลางกรุงเทพอภิวัฒน์',coords:[100.54167,13.805],icon:'🚉',kind:'station'},
 {name:'สวนลุมพินี',coords:[100.5417,13.7307],icon:'🌳',kind:'park'},
 {name:'สวนเบญจกิติ',coords:[100.5582,13.7252],icon:'🌿',kind:'park'},
 {name:'สวนจตุจักร',coords:[100.5549,13.8024],icon:'🌲',kind:'park'},
 {name:'SCB Park',coords:[100.5687,13.8280],icon:'🏢',kind:'tower'}
];
const cityPropData=[
 {coords:[100.5409,13.7310],icon:'🌳',kind:'tree'},{coords:[100.5425,13.7318],icon:'🌳',kind:'tree'},{coords:[100.5434,13.7299],icon:'🌴',kind:'tree'},{coords:[100.5402,13.7296],icon:'🌷',kind:'flower'},
 {coords:[100.5575,13.7258],icon:'🌳',kind:'tree'},{coords:[100.5590,13.7248],icon:'🌴',kind:'tree'},{coords:[100.5572,13.7239],icon:'🪑',kind:'bench'},{coords:[100.5595,13.7261],icon:'💡',kind:'lamp'},
 {coords:[100.5538,13.8022],icon:'🌳',kind:'tree'},{coords:[100.5558,13.8014],icon:'🌴',kind:'tree'},{coords:[100.5564,13.8030],icon:'🌷',kind:'flower'},{coords:[100.5536,13.8033],icon:'🪑',kind:'bench'}
];
function addLandmarkMarkers(){
 landmarkData.forEach(place=>{
  const el=document.createElement('div');el.className='landmark landmark-'+place.kind;
  el.innerHTML=(place.icon?'<span class="landmark-icon">'+place.icon+'</span>':'')+'<span class="landmark-name">'+place.name+'</span>';
  new maplibregl.Marker({element:el,anchor:'bottom'}).setLngLat(place.coords).addTo(map);
 });
}
function addCityPropsMarkers(){
 cityPropData.forEach((prop,i)=>{
  const el=document.createElement('div');el.className='city-prop city-prop-'+prop.kind;
  el.innerHTML='<span>'+prop.icon+'</span>';
  el.setAttribute('aria-label',({tree:'ต้นไม้',flower:'แปลงดอกไม้',bench:'ม้านั่ง',lamp:'ไฟถนน'})[prop.kind]||'ของตกแต่งเมือง');
  new maplibregl.Marker({element:el,anchor:'bottom'}).setLngLat(prop.coords).addTo(map);
 });
}


function createElephantBuildingLayer(){
 const origin=maplibregl.MercatorCoordinate.fromLngLat({lng:100.56861,lat:13.82528},0);
 const unit=origin.meterInMercatorCoordinateUnits();
 const verts=[];
 const palette={front:[0.48,0.76,0.80],side:[0.20,0.48,0.58],top:[0.78,0.91,0.86],glass:[0.035,0.22,0.40],dark:[0.025,0.075,0.15],trim:[1.00,0.72,0.20],highlight:[0.94,0.97,0.83],shadow:[0.12,0.23,0.25]};
 function tri(a,b,c,col){for(const p of [a,b,c])verts.push(origin.x+p[0]*unit,origin.y-p[1]*unit,p[2]*unit,col[0],col[1],col[2])}
 function quad(a,b,c,d,col){tri(a,b,c,col);tri(a,c,d,col)}
 function box(x,y,z,w,d,h,colors){
  const x0=x-w/2,x1=x+w/2,y0=y-d/2,y1=y+d/2,z0=z,z1=z+h;
  quad([x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1],colors.front);
  quad([x1,y1,z0],[x0,y1,z0],[x0,y1,z1],[x1,y1,z1],colors.side);
  quad([x0,y1,z0],[x0,y0,z0],[x0,y0,z1],[x0,y1,z1],colors.side);
  quad([x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[x1,y0,z1],colors.front);
  quad([x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],colors.top);
  quad([x0,y1,z0],[x1,y1,z0],[x1,y0,z0],[x0,y0,z0],colors.dark);
 }
 const concrete={front:palette.front,side:palette.side,top:palette.top};
 // Soft cartoon-style cast shadow, offset behind the building footprint.
 quad([-86,34,0.18],[86,34,0.18],[102,62,0.18],[-70,62,0.18],palette.shadow);
 // Three real tower masses, with the upper connecting residential bridge.
 box(0,0,0,145,38,8,{front:palette.side,side:palette.dark,top:palette.top});
 box(-47,0,8,34,34,94,concrete);
 box(0,0,8,34,34,94,concrete);
 box(47,0,8,34,34,94,concrete);
 box(0,0,78,145,38,24,{front:palette.front,side:palette.side,top:palette.top});
 // Sunlit roof rim and warm horizontal cartoon accent bands.
 box(0,-19.4,100.5,146,2.2,2.2,{front:palette.highlight,side:palette.trim,top:palette.highlight});
 for(const cx of [-47,0,47]){box(cx,-19.1,35,34.5,1.8,1.25,{front:palette.highlight,side:palette.trim,top:palette.highlight});box(cx,-19.1,68,34.5,1.8,1.25,{front:palette.highlight,side:palette.trim,top:palette.highlight});}
 // Repeated cartoon glass windows on the visible south and east-facing elevations.
 for(const cx of [-47,0,47]){
  for(let floor=0;floor<25;floor++){
   const z=12+floor*3.35;
   for(let col=0;col<5;col++){
    const x=cx-12+col*6;
    box(x,-17.25,z,3.4,.34,2.15,{front:palette.glass,side:palette.dark,top:palette.glass});
    box(cx+17.25,-11+col*5.5,z,.34,3.1,2.15,{front:palette.glass,side:palette.dark,top:palette.glass});
   }
  }
 }
 // Balcony/ear-like horizontal fins and the two circular eye windows.
 box(-64,-1,63,18,42,2,{front:palette.trim,side:palette.side,top:palette.top});
 box(64,-1,63,18,42,2,{front:palette.trim,side:palette.side,top:palette.top});
 function disc(cx,cy,cz,r,color){
  const c=[cx,cy,cz],n=24;
  for(let i=0;i<n;i++){
   const a=i*Math.PI*2/n,b=(i+1)*Math.PI*2/n;
   tri(c,[cx+Math.cos(a)*r,cy,cz+Math.sin(a)*r],[cx+Math.cos(b)*r,cy,cz+Math.sin(b)*r],color);
  }
 }
 disc(-10,-17.55,88,4.1,palette.dark);disc(-10,-17.8,88,2.8,palette.glass);
 disc(10,-17.55,88,4.1,palette.dark);disc(10,-17.8,88,2.8,palette.glass);
 // Short ivory-colored projecting tusks at the front of the trunk mass.
 box(-14,-22,58,4,12,3,{front:palette.trim,side:palette.trim,top:palette.top});
 box(14,-22,58,4,12,3,{front:palette.trim,side:palette.trim,top:palette.top});
 return {
  id:'mapatlas-elephant-3d',type:'custom',renderingMode:'3d',
  onAdd(mapRef,gl){
   const vs='attribute vec3 a_pos;attribute vec3 a_color;uniform mat4 u_matrix;varying vec3 v_color;void main(){gl_Position=u_matrix*vec4(a_pos,1.0);v_color=a_color;}';
   const fs='precision mediump float;varying vec3 v_color;void main(){gl_FragColor=vec4(v_color,1.0);}';
   const compile=(type,src)=>{const sh=gl.createShader(type);gl.shaderSource(sh,src);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(sh));return sh};
   this.program=gl.createProgram();gl.attachShader(this.program,compile(gl.VERTEX_SHADER,vs));gl.attachShader(this.program,compile(gl.FRAGMENT_SHADER,fs));gl.linkProgram(this.program);
   if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(this.program));
   this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(verts),gl.STATIC_DRAW);
   this.count=verts.length/6;this.map=mapRef;
  },
  render(gl,matrix){
   if(!this.program)return;
   gl.useProgram(this.program);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
   const p=gl.getAttribLocation(this.program,'a_pos'),c=gl.getAttribLocation(this.program,'a_color');
   gl.enableVertexAttribArray(p);gl.vertexAttribPointer(p,3,gl.FLOAT,false,24,0);
   gl.enableVertexAttribArray(c);gl.vertexAttribPointer(c,3,gl.FLOAT,false,24,12);
   gl.uniformMatrix4fv(gl.getUniformLocation(this.program,'u_matrix'),false,matrix);
   gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);
   gl.drawArrays(gl.TRIANGLES,0,this.count);
   gl.bindBuffer(gl.ARRAY_BUFFER,null);
  },
  onRemove(mapRef,gl){if(this.buffer)gl.deleteBuffer(this.buffer);if(this.program)gl.deleteProgram(this.program)}
 };
}

function setStatus(a,b,arrow){$('turnDistance').textContent=a;$('turnText').textContent=b;$('turnArrow').textContent=arrow||'⬆'}
function distM(a,b){const R=6371000,p=Math.PI/180,dp=(b[1]-a[1])*p,dl=(b[0]-a[0])*p,x=Math.sin(dp/2)**2+Math.cos(a[1]*p)*Math.cos(b[1]*p)*Math.sin(dl/2)**2;return 2*R*Math.asin(Math.sqrt(x))}
function fmtDist(m){return m>=1000?(m/1000).toFixed(1)+' กม.':Math.round(m)+' ม.'}
function maneuver(s){const m=s.maneuver||{},type=m.type||'continue',mod=m.modifier||'';if(type==='arrive')return ['🏁','ถึงจุดหมายแล้ว','🏁'];if(type==='roundabout'||type==='rotary')return ['↻','เข้าวงเวียน','↻'];if(mod.includes('left'))return ['↰','เลี้ยวซ้าย','⬅'];if(mod.includes('right'))return ['↱','เลี้ยวขวา','➡'];if(type==='uturn')return ['↶','กลับรถ','↶'];if(type==='depart')return ['⬆','มุ่งหน้าตรงไป','⬆'];return ['⬆','ตรงไป','⬆']}
function addRouteLayer(){if(!map.getSource('routeLine'))map.addSource('routeLine',{type:'geojson',data:{type:'Feature',geometry:{type:'LineString',coordinates:[]}}});if(!map.getLayer('routeGlow'))map.addLayer({id:'routeGlow',type:'line',source:'routeLine',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#00c8ff','line-width':13,'line-opacity':.38,'line-blur':2}});if(!map.getLayer('routeLineLayer'))map.addLayer({id:'routeLineLayer',type:'line',source:'routeLine',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#087dff','line-width':6,'line-opacity':.98}})}
map.on('load',()=>{
 mapReady=true;
 // Create the navigation source/layers FIRST. Optional 3D decoration must never block routing.
 try{
  addRouteLayer();
  setStatus('พร้อมนำทาง','เลือกจุดหมายจากช่องค้นหาหรือแตะแผนที่');
 }catch(e){console.error('MapAtlas route layer initialization failed',e);notice('เตรียมระบบเส้นทางไม่สำเร็จ: '+(e.message||e))}
 // Keep optional map styling isolated so a 3D/style error cannot disable navigation.
 try{
  const layers=map.getStyle().layers||[];const label=layers.find(l=>l.type==='symbol'&&l.layout&&l.layout['text-field']);
  if(map.getSource('openmaptiles')&&!map.getLayer('mapatlas-cartoon-buildings'))map.addLayer({id:'mapatlas-cartoon-buildings',source:'openmaptiles','source-layer':'building',type:'fill-extrusion',minzoom:13,paint:{'fill-extrusion-color':['match',['get','class'],'commercial','#ffc58d','industrial','#b7d4ef','residential','#c5e8c9','retail','#f4b7d5','school','#ffe08a','hospital','#f4a2a2','#bfe5c9'],'fill-extrusion-height':['max',['coalesce',['get','render_height'],0],7],'fill-extrusion-base':['coalesce',['get','render_min_height'],0],'fill-extrusion-opacity':0.98,'fill-extrusion-vertical-gradient':true}},label?label.id:undefined);
  if(map.getSource('openmaptiles')&&!map.getLayer('mapatlas-cartoon-building-edges'))map.addLayer({id:'mapatlas-cartoon-building-edges',source:'openmaptiles','source-layer':'building',type:'line',minzoom:14,paint:{'line-color':'#638b78','line-width':['interpolate',['linear'],['zoom'],14,0.45,18,1.1],'line-opacity':0.62}});
 }catch(e){console.warn('MapAtlas cartoon building layer skipped; navigation remains available',e)}
 try{addLandmarkMarkers();addCityPropsMarkers()}catch(e){console.warn('MapAtlas cartoon city props skipped',e)}
 try{if(!map.getLayer('mapatlas-elephant-3d'))map.addLayer(createElephantBuildingLayer())}catch(e){console.warn('MapAtlas 3D landmark layer skipped; navigation remains available',e)}
});
map.on('error',e=>console.warn('Map error',e.error));
function selectDest(lon,lat,name){dest={lon,lat,name:name||'จุดหมาย'};$('placeSearch').value=dest.name;if(destMarker)destMarker.remove();destMarker=new maplibregl.Marker({element:markerEl('📍','bike')}).setLngLat([lon,lat]).addTo(map);map.flyTo({center:[lon,lat],zoom:16.5,pitch:is3D?62:0,duration:900});setStatus('เลือกแล้ว: '+dest.name,'กดเริ่มนำทางเมื่อพร้อม');}
document.querySelectorAll('.chip').forEach(b=>b.addEventListener('click',()=>selectDest(+b.dataset.lon,+b.dataset.lat,b.dataset.name)));
map.on('click',e=>{if(route)return;selectDest(e.lngLat.lng,e.lngLat.lat,'ตำแหน่งบนแผนที่')});
async function searchPlace(){const q=$('placeSearch').value.trim();if(!q)return notice('พิมพ์ชื่อสถานที่ก่อน');notice('กำลังค้นหาสถานที่…');try{const u='https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=th&q='+encodeURIComponent(q);const r=await fetch(u);if(!r.ok)throw Error('search');const a=await r.json();if(!a.length)return notice('ไม่พบสถานที่นี้ ลองใช้ชื่ออื่น');selectDest(+a[0].lon,+a[0].lat,a[0].name||q)}catch(e){notice('ค้นหาไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่')}}
$('searchBtn').onclick=searchPlace;$('placeSearch').addEventListener('keydown',e=>{if(e.key==='Enter')searchPlace()});
async function requestGeoPermission(){
 if(Capacitor.isNativePlatform()){
  let p=await Geolocation.checkPermissions();
  if(p.location!=='granted'&&p.coarseLocation!=='granted')p=await Geolocation.requestPermissions({permissions:['location']});
  if(p.location!=='granted'&&p.coarseLocation!=='granted')throw Error('ยังไม่ได้อนุญาตตำแหน่ง (location: '+p.location+', coarse: '+p.coarseLocation+')');
  return {
   getCurrentPosition:o=>Geolocation.getCurrentPosition(o),
   watchPosition:(o,cb)=>Geolocation.watchPosition(o,cb),
   clearWatch:id=>Geolocation.clearWatch({id})
  };
 }
 if(!navigator.geolocation)throw Error('อุปกรณ์นี้ไม่รองรับ Geolocation');
 return {
  getCurrentPosition:o=>new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,o)),
  watchPosition:(o,cb)=>Promise.resolve(navigator.geolocation.watchPosition(p=>cb(p),e=>cb(null,e),o)),
  clearWatch:id=>navigator.geolocation.clearWatch(id)
 };
}
function gpsError(e){
 const msg=String(e?.message||e||'ไม่ทราบสาเหตุ');
 if(/location services|location provider|provider disabled|location disabled/i.test(msg))return 'GPS ในเครื่องปิดอยู่ กรุณาเปิดบริการตำแหน่ง (Location)';
 if(/permission|denied|not authorized/i.test(msg))return 'ไม่ได้รับอนุญาตตำแหน่ง กรุณาตั้งค่าแอปเป็นอนุญาตขณะใช้แอป';
 if(/timeout|timed out/i.test(msg))return 'ค้นหาพิกัดนานเกินไป ลองออกไปที่โล่งและเปิดตำแหน่งแบบแม่นยำ';
 return msg;
}
async function locate(){
 if(gpsBusy)return;
 gpsBusy=true;
 try{
  setStatus('กำลังค้นหา GPS…','กำลังตรวจสอบสิทธิ์และรับพิกัด');
  notice('กำลังตรวจสอบสิทธิ์ GPS…');
  const Geo=await requestGeoPermission();
  setStatus('กำลังค้นหาตำแหน่ง…','รอสัญญาณ GPS');
  const p=await Geo.getCurrentPosition({enableHighAccuracy:true,timeout:30000,maximumAge:0});
  onPosition(p);
  map.flyTo({center:[me.lon,me.lat],zoom:17.5,pitch:is3D?62:0});
  setStatus('พบตำแหน่งแล้ว','ความแม่นยำประมาณ ±'+Math.round(p.coords.accuracy)+' เมตร');
  notice('GPS ใช้งานได้ · '+me.lat.toFixed(6)+', '+me.lon.toFixed(6)+' · คลาดเคลื่อน ±'+Math.round(p.coords.accuracy)+' ม.');
 }catch(e){
  const m=gpsError(e);
  setStatus('ยังระบุตำแหน่งไม่ได้',m);
  notice('GPS: '+m);
  console.error('MapAtlas GPS error',e);
 }finally{gpsBusy=false}
}
function onPosition(p){
 const previous=me;
 me={lat:p.coords.latitude,lon:p.coords.longitude,accuracy:p.coords.accuracy};
 if(!userMarker)userMarker=new maplibregl.Marker({element:markerEl('🏍️','bike'),anchor:'bottom'}).setLngLat([me.lon,me.lat]).addTo(map);
 else userMarker.setLngLat([me.lon,me.lat]);
 if(route){
  // Live navigation camera: keep the rider in view and move the map as GPS changes.
  let bearing=Number.isFinite(p.coords.heading)&&p.coords.heading>=0?p.coords.heading:null;
  if(bearing===null&&previous){
   const d=distM([previous.lon,previous.lat],[me.lon,me.lat]);
   if(d>4){
    const a=previous.lat*Math.PI/180,b=me.lat*Math.PI/180,dl=(me.lon-previous.lon)*Math.PI/180;
    const y=Math.sin(dl)*Math.cos(b),x=Math.cos(a)*Math.sin(b)-Math.sin(a)*Math.cos(b)*Math.cos(dl);
    bearing=(Math.atan2(y,x)*180/Math.PI+360)%360;
   }
  }
  const now=Date.now();
  if(now-lastCameraAt>650){
   const camera={center:[me.lon,me.lat],zoom:Math.max(map.getZoom(),17),pitch:is3D?58:0};
   if(bearing!==null){lastCameraBearing=bearing;camera.bearing=bearing}
   else if(lastCameraBearing!==null)camera.bearing=lastCameraBearing;
   // GPS has already supplied a fresh fix. Jumping directly avoids stacked/cancelled
   // easing animations that can make the map appear frozen during continuous tracking.
   map.stop();
   map.jumpTo(camera);
   lastCameraAt=now;
  }
  updateNavigation();
 }
}
$('gps').onclick=locate;
async function requestRoute(from,to){
 const valid=p=>Array.isArray(p)&&p.length===2&&Number.isFinite(p[0])&&Number.isFinite(p[1])&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90;
 if(!valid(from)||!valid(to))throw Error('พิกัดต้นทางหรือปลายทางไม่ถูกต้อง');
 if(distM(from,to)<20)throw Error('ตำแหน่งปัจจุบันอยู่ใกล้จุดหมายมากแล้ว');
 const coords=from[0]+','+from[1]+';'+to[0]+','+to[1];
 const providers=[
  {name:'OSRM หลัก',url:'https://router.project-osrm.org/route/v1/driving/'+coords},
  {name:'OSM สำรอง',url:'https://routing.openstreetmap.de/routed-car/route/v1/driving/'+coords}
 ];
 const failures=[];
 for(const provider of providers){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),12000);
  try{
   const response=await fetch(provider.url+'?alternatives=true&steps=true&overview=full&geometries=geojson&continue_straight=true&generate_hints=false&skip_waypoints=false&radiuses=100;100',{signal:controller.signal,cache:'no-store'});
   if(!response.ok)throw Error('HTTP '+response.status);
   const data=await response.json();
   if(data.code!=='Ok'||!Array.isArray(data.routes)||!data.routes.length)throw Error(data.message||data.code||'ไม่พบเส้นทาง');
   const chosen=data.routes[0];
   if(!chosen.geometry?.coordinates?.length||!chosen.legs?.length)throw Error('ข้อมูลเส้นทางไม่ครบ');
   return chosen;
  }catch(e){
   const why=e.name==='AbortError'?'หมดเวลารอ 12 วินาที':(e.message||'เชื่อมต่อไม่ได้');
   failures.push(provider.name+': '+why);
   console.warn('MapAtlas routing provider failed',provider.name,e);
  }finally{clearTimeout(timer)}
 }
 throw Error(failures.join(' | '));
}
async function getRoute(recalc){
 if(!dest)return notice('เลือกจุดหมายก่อน');
 if(routeBusy)return;
 routeBusy=true;
 let Geo;
 try{
  Geo=await requestGeoPermission();
  setStatus('กำลังอ่านตำแหน่ง GPS…','รับพิกัดล่าสุดก่อนคำนวณเส้นทาง');
  const p=await Geo.getCurrentPosition({enableHighAccuracy:true,timeout:30000,maximumAge:0});
  onPosition(p);
  if(!Number.isFinite(me?.lat)||!Number.isFinite(me?.lon))throw Error('อ่านพิกัด GPS ไม่สำเร็จ');
  if(watchId===null){
   watchId=await Geo.watchPosition({enableHighAccuracy:true,maximumAge:1000,timeout:20000},(position,error)=>{
    if(position)onPosition(position);
    else if(error){console.warn('GPS watch error',error);notice('GPS ขาดการเชื่อมต่อ: '+gpsError(error))}
   });
  }
 }catch(e){
  const m=gpsError(e);
  setStatus('ยังใช้ GPS ไม่ได้',m);
  routeBusy=false;
  return notice('ยังใช้ GPS ไม่ได้: '+m);
 }
 setStatus('กำลังคำนวณเส้นทาง…','กำลังเชื่อมต่อบริการแผนที่');
 try{
  // Wait for the initial style load, not for every map tile/3D building to finish downloading.
  if(!mapReady){
   await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('แผนที่ยังโหลดไม่เสร็จ กรุณารอสักครู่แล้วลองใหม่')),15000);
    map.once('load',()=>{clearTimeout(timer);mapReady=true;resolve()});
   });
  }
  // Recover if an optional 3D layer previously interrupted route-layer setup.
  if(!map.getSource('routeLine'))addRouteLayer();
  if(!map.getSource('routeLine'))throw Error('สร้างชั้นแสดงเส้นทางไม่สำเร็จ');
  const result=await requestRoute([me.lon,me.lat],[dest.lon,dest.lat]);
  route=result;
  steps=route.legs.flatMap(l=>l.steps||[]).filter(s=>s.maneuver);
  stepIndex=Math.min(1,Math.max(0,steps.length-1));
  const source=map.getSource('routeLine');
  if(!source)throw Error('แผนที่ยังโหลดไม่เสร็จ กรุณาลองอีกครั้ง');
  source.setData({type:'Feature',properties:{},geometry:route.geometry});
  const mins=Math.max(1,Math.round(route.duration/60));
  const arrival=new Date(Date.now()+route.duration*1000);
  $('eta').textContent=arrival.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'});
  $('distance').textContent=fmtDist(route.distance);
  // Enter live navigation view focused on the rider; the route remains drawn ahead.
  lastCameraAt=Date.now();
  lastCameraBearing=Number.isFinite(p.coords.heading)&&p.coords.heading>=0?p.coords.heading:null;
  map.easeTo({center:[me.lon,me.lat],zoom:17.2,pitch:is3D?62:0,duration:900,...(lastCameraBearing!==null?{bearing:lastCameraBearing}:{})});
  setStatus(recalc?'คำนวณเส้นทางใหม่แล้ว':'เส้นทางพร้อมแล้ว','ประมาณ '+mins+' นาที · '+dest.name);
  notice('คำนวณเส้นทางสำเร็จ · ถึงประมาณ '+arrival.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})+' · ใช้โปรไฟล์รถยนต์ ไม่ใช่มอเตอร์ไซค์เฉพาะ');
  updateNavigation(true);
 }catch(e){
  route=null;steps=[];stepIndex=0;
  if(map.getSource('routeLine'))map.getSource('routeLine').setData({type:'Feature',properties:{},geometry:{type:'LineString',coordinates:[]}});
  $('eta').textContent='—';$('distance').textContent='—';
  const reason=String(e?.message||e||'ไม่ทราบสาเหตุ');
  setStatus('คำนวณเส้นทางไม่ได้',reason);
  notice('คำนวณเส้นทางไม่สำเร็จ: '+reason);
  console.error('MapAtlas route calculation failed',e);
 }finally{routeBusy=false}
}
function updateNavigation(initial){if(!route||!me)return;const here=[me.lon,me.lat];let near=Infinity;for(const c of route.geometry.coordinates){const d=distM(here,c);if(d<near)near=d}
if(near>85&&Date.now()-lastReroute>12000){lastReroute=Date.now();getRoute(true);return}
let s=steps[stepIndex];if(!s)return;let target=s.maneuver?.location||s.geometry?.coordinates?.[0];let left=target?distM(here,target):0;
if(left<28&&stepIndex<steps.length-1){stepIndex++;s=steps[stepIndex];target=s.maneuver?.location||s.geometry?.coordinates?.[0];left=target?distM(here,target):0}
const [ic,txt,ar]=maneuver(s);setStatus(left<30?'ถึงจุดเลี้ยวแล้ว':'อีก '+fmtDist(left),txt,ar);if(initial||left<220&&left>170)say('อีก '+Math.round(left/10)*10+' เมตร '+txt);
if(stepIndex>=steps.length-1&&left<25){setStatus('ถึงจุดหมายแล้ว','เดินทางโดยสวัสดิภาพ','🏁');say('ถึงจุดหมายแล้ว');route=null}
}
$('start').onclick=()=>{getRoute(false)};
$('stop').onclick=()=>{route=null;steps=[];stepIndex=0;if(watchId!==null){requestGeoPermission().then(Geo=>Geo.clearWatch(watchId)).catch(()=>{});watchId=null}if(map.getSource('routeLine'))map.getSource('routeLine').setData({type:'Feature',geometry:{type:'LineString',coordinates:[]}});$('eta').textContent='—';$('distance').textContent='—';setStatus('ยกเลิกเส้นทางแล้ว','เลือกจุดหมายเพื่อเริ่มใหม่')};
$('voice').onclick=()=>{voiceOn=!voiceOn;$('voice').textContent=voiceOn?'🔊':'🔇';if(!voiceOn&&'speechSynthesis'in window)speechSynthesis.cancel();notice(voiceOn?'เปิดเสียงนำทาง':'ปิดเสียงนำทาง')};
$('tilt').onclick=()=>{is3D=!is3D;map.easeTo({pitch:is3D?62:0,duration:700});$('tilt').textContent=is3D?'3D':'2D'};
$('zoomIn').onclick=()=>map.zoomTo(map.getZoom()+1);$('zoomOut').onclick=()=>map.zoomTo(map.getZoom()-1);$('compass').onclick=()=>map.easeTo({bearing:0,pitch:is3D?62:0,duration:600});
$('settings').onclick=()=>notice('รุ่นทดลอง: เส้นทาง OSRM ใช้โปรไฟล์รถยนต์ ไม่ใช่เส้นทางมอเตอร์ไซค์เฉพาะ โปรดตรวจป้ายและข้อห้าม');
})();
