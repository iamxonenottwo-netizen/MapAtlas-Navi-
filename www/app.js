import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
(()=> {
const $=id=>document.getElementById(id);
let me=null,dest=null,route=null,steps=[],stepIndex=0,watchId=null,userMarker=null,destMarker=null,voiceOn=true,routeBusy=false,gpsBusy=false,lastReroute=0,is3D=true;
const map=new maplibregl.Map({container:'map',style:'https://tiles.openfreemap.org/styles/bright',center:[100.5342,13.7456],zoom:15.5,pitch:62,bearing:-18,antialias:true});
map.addControl(new maplibregl.NavigationControl({showCompass:false,showZoom:false}),'top-right');
function say(t){if(voiceOn&&'speechSynthesis'in window){speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(t);u.lang='th-TH';u.rate=1;speechSynthesis.speak(u)}}
function notice(t){$('notice').textContent=t;$('notice').style.display='block';clearTimeout(notice.timer);notice.timer=setTimeout(()=>$('notice').style.display='none',3500)}
function markerEl(txt,cls){const e=document.createElement('div');e.className=cls||'';e.textContent=txt;return e}
const landmarkData=[
 {name:'ตึกช้าง',coords:[100.56861,13.82528],icon:'',kind:'elephant'},
 {name:'ใบหยก 2',coords:[100.540556,13.754167],icon:'🏙️',kind:'tower'},
 {name:'สถานีกลางกรุงเทพอภิวัฒน์',coords:[100.54167,13.805],icon:'🚉',kind:'station'}
];
function addLandmarkMarkers(){
 landmarkData.forEach(place=>{
  const el=document.createElement('div');el.className='landmark landmark-'+place.kind;
  el.innerHTML=(place.icon?'<span class="landmark-icon">'+place.icon+'</span>':'')+'<span class="landmark-name">'+place.name+'</span>';
  new maplibregl.Marker({element:el,anchor:'bottom'}).setLngLat(place.coords).addTo(map);
 });
}


function createElephantBuildingLayer(){
 const origin=maplibregl.MercatorCoordinate.fromLngLat({lng:100.56861,lat:13.82528},0);
 const unit=origin.meterInMercatorCoordinateUnits();
 const verts=[];
 const palette={front:[0.77,0.84,0.88],side:[0.55,0.67,0.74],top:[0.91,0.94,0.95],glass:[0.12,0.36,0.53],dark:[0.08,0.19,0.27],trim:[0.96,0.79,0.43]};
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
 // Three real tower masses, with the upper connecting residential bridge.
 box(0,0,0,145,38,8,{front:palette.side,side:palette.dark,top:palette.top});
 box(-47,0,8,34,34,94,concrete);
 box(0,0,8,34,34,94,concrete);
 box(47,0,8,34,34,94,concrete);
 box(0,0,78,145,38,24,{front:palette.front,side:palette.side,top:palette.top});
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
 const layers=map.getStyle().layers||[];const label=layers.find(l=>l.type==='symbol'&&l.layout&&l.layout['text-field']);
 if(map.getSource('openmaptiles'))map.addLayer({id:'mapatlas-cartoon-buildings',source:'openmaptiles','source-layer':'building',type:'fill-extrusion',minzoom:13,paint:{'fill-extrusion-color':['match',['get','class'],'commercial','#ffbd80','industrial','#a9c8ef','residential','#ffe0a3','retail','#f5a9cc','school','#f7d56b','hospital','#f28f8f','#b9dfc0'],'fill-extrusion-height':['max',['coalesce',['get','render_height'],0],6],'fill-extrusion-base':['coalesce',['get','render_min_height'],0],'fill-extrusion-opacity':1,'fill-extrusion-vertical-gradient':true}},label?label.id:undefined);
 addLandmarkMarkers();
 if(!map.getLayer('mapatlas-elephant-3d'))map.addLayer(createElephantBuildingLayer());
 addRouteLayer();setStatus('พร้อมนำทาง','เลือกจุดหมายจากช่องค้นหาหรือแตะแผนที่');
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
function onPosition(p){me={lat:p.coords.latitude,lon:p.coords.longitude,accuracy:p.coords.accuracy};if(!userMarker)userMarker=new maplibregl.Marker({element:markerEl('🏍️','bike'),anchor:'bottom'}).setLngLat([me.lon,me.lat]).addTo(map);else userMarker.setLngLat([me.lon,me.lat]);if(route)updateNavigation()}
$('gps').onclick=locate;
async function getRoute(recalc){if(!dest)return notice('เลือกจุดหมายก่อน');if(routeBusy)return;let Geo;try{Geo=await requestGeoPermission();if(!me){setStatus('กำลังค้นหา GPS…','รอสัญญาณตำแหน่ง');const p=await Geo.getCurrentPosition({enableHighAccuracy:true,timeout:30000,maximumAge:0});onPosition(p)}if(watchId===null){watchId=await Geo.watchPosition({enableHighAccuracy:true,maximumAge:1000,timeout:20000},(p,e)=>{if(p)onPosition(p);else if(e){console.warn('GPS watch error',e);notice('GPS ขาดการเชื่อมต่อ: '+gpsError(e))}})}}catch(e){const m=gpsError(e);setStatus('ยังใช้ GPS ไม่ได้',m);return notice('ยังใช้ GPS ไม่ได้: '+m)}if(routeBusy)return;routeBusy=true;setStatus('กำลังคำนวณเส้นทาง…','รอสักครู่');try{const url='https://router.project-osrm.org/route/v1/driving/'+me.lon+','+me.lat+';'+dest.lon+','+dest.lat+'?overview=full&geometries=geojson&steps=true';const r=await fetch(url);if(!r.ok)throw Error('route');const d=await r.json();if(d.code!=='Ok'||!d.routes?.length)throw Error('no route');route=d.routes[0];steps=route.legs.flatMap(l=>l.steps||[]).filter(s=>s.maneuver);stepIndex=Math.min(1,Math.max(0,steps.length-1));map.getSource('routeLine').setData({type:'Feature',properties:{},geometry:route.geometry});$('eta').textContent=Math.max(1,Math.round(route.duration/60))+' นาที';$('distance').textContent=fmtDist(route.distance);map.fitBounds([[Math.min(me.lon,dest.lon),Math.min(me.lat,dest.lat)],[Math.max(me.lon,dest.lon),Math.max(me.lat,dest.lat)]],{padding:{top:260,bottom:190,left:55,right:55},maxZoom:17,duration:900});setStatus(recalc?'คำนวณเส้นทางใหม่แล้ว':'เส้นทางพร้อมแล้ว','เส้นทางทดลอง · ตรวจป้ายและข้อห้ามก่อนขับ');notice('ข้อจำกัด: เส้นทางนี้ใช้โปรไฟล์รถยนต์ ยังไม่ใช่ระบบนำทางมอเตอร์ไซค์โดยเฉพาะ');updateNavigation(true);}catch(e){route=null;setStatus('คำนวณเส้นทางไม่ได้','ตรวจอินเทอร์เน็ต หรือเลือกจุดหมายใหม่');notice('บริการเส้นทางสาธารณะไม่ตอบสนอง ลองอีกครั้ง');}finally{routeBusy=false}}
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
