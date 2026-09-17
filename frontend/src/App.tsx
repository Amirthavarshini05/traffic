{/*import { useEffect, useMemo, useRef, useState } from "react";
import { Map, Marker, Popup, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./App.css";
import maplibreWorker from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
setWorkerUrl(maplibreWorker);

interface Camera { camera_id:string; camera_name:string; status:string; longitude:number; latitude:number }
interface CamerasResponse { cameras:Camera[] }
interface CameraHealth { camera_id:string; camera_name:string; configured_status:string; last_event_at:string|null; health_status:string; minutes_since_last_event:number|null }
interface CameraHealthResponse { cameras:CameraHealth[] }
interface CameraRoute { route_id:number; starting_node:string; ending_node:string; total_distance_m:number; geometry:{type:"MultiLineString";coordinates:number[][][]} }
interface RealtimeTrajectory { trajectory_id:number; vehicle_id:string; from_camera_id:string; to_camera_id:string; start_event_id:number; end_event_id:number; event_type:string }
interface CameraRoutesResponse { routes:CameraRoute[] }
interface Alert { alert_id:number; alert_type:string; severity:string; message:string; vehicle_id:number|null; road_id:string|null; camera_id:string|null; camera_name:string|null; zone_id:number|null; zone_name:string|null; authority_name:string|null; detected_at:string; resolved_at:string|null; status:string; metadata:unknown|null; created_at:string }
interface AlertsResponse { alerts:Alert[] }
interface AnalyticsSummary { total_cameras:number; healthy_cameras:number; warning_cameras:number; offline_cameras:number; total_alerts:number; active_alerts:number; high_alerts:number; medium_alerts:number; critical_alerts:number }
interface HistoricalCongestion { from_camera_id:string; to_camera_id:string; time_window_start:string; time_window_end:string; vehicle_count:number; baseline_travel_time_seconds:number; average_travel_time_seconds:number; average_delay_seconds:number; average_delay_percent:number; congestion_level:string }
interface HistoricalCongestionResponse { congestion:HistoricalCongestion[] }
interface ZoneTraffic { zone_id:number; zone_name:string; authority_name:string|null; event_count:number; vehicle_count:number }
interface ZoneTrafficResponse { zones:ZoneTraffic[] }
interface RouteTraffic { from_camera_id:string; to_camera_id:string; trajectory_count:number; vehicle_count:number; average_travel_time_seconds:number }
interface RouteTrafficResponse { routes:RouteTraffic[] }
interface ODMatrixEntry { origin:string; destination:string; vehicle_count:number }
interface ODMatrixResponse { matrix:ODMatrixEntry[] }
type Tab="Live Map"|"Analytics"|"Vehicles"|"Alerts"|"Settings";
const nav:[Tab,string][]=[["Live Map","◈"],["Analytics","⌁"],["Vehicles","▣"],["Alerts","△"],["Settings","⚙"]];
const vehicleRows=[["TN 01 AX 4821","Sedan","Anna Salai → Guindy","52 km/h","Just now","Authorized"],["TN 09 BV 1907","SUV","OMR → Perungudi","78 km/h","2 min ago","Flagged"],["TN 22 CP 8824","Truck","Poonamallee → Central","42 km/h","4 min ago","Priority"],["TN 14 DK 5516","Hatchback","Adyar → T. Nagar","64 km/h","6 min ago","Suspicious"]];
function Spark({color="#3b82f6"}:{color?:string}) {return <svg className="spark" viewBox="0 0 150 45" preserveAspectRatio="none"><path d="M0 38 C15 30 19 35 31 25 S48 31 60 18 S81 29 92 15 S112 22 125 8 S141 16 150 4" fill="none" stroke={color} strokeWidth="2.5"/><path d="M0 38 C15 30 19 35 31 25 S48 31 60 18 S81 29 92 15 S112 22 125 8 S141 16 150 4 L150 45 L0 45Z" fill={color} opacity=".1"/></svg>}
function Metric({icon,label,value,trend,color="blue"}:{icon:string;label:string;value:string;trend?:string;color?:string}) {return <article className="metric panel"><i className={color}>{icon}</i><div><p>{label}</p><h2>{value}</h2>{trend&&<span>↗ {trend} <small>vs last week</small></span>}</div><Spark color={color==="purple"?"#8b5cf6":color==="green"?"#10b981":color==="orange"?"#f59e0b":"#3b82f6"}/></article>}
function DataChart({data,color,unit}:{data:{label:string;value:number}[];color:string;unit:string}){if(!data.length)return <div className="chart-empty">No data available</div>;const max=Math.max(...data.map(item=>item.value),1);const points=data.map((item,index)=>`${index*(240/Math.max(data.length-1,1))},${92-(item.value/max)*72}`).join(" ");return <div style={{position:"absolute",left:18,right:18,bottom:18,height:120}}><svg viewBox="0 0 240 100" preserveAspectRatio="none" style={{width:"100%",height:96,overflow:"visible"}}><polyline points={points} fill="none" stroke={color} strokeWidth="3" vectorEffect="non-scaling-stroke"/>{data.map((item,index)=><circle key={item.label} cx={index*(240/Math.max(data.length-1,1))} cy={92-(item.value/max)*72} r="3" fill={color}/>)}</svg><div style={{display:"flex",justifyContent:"space-between",gap:6,overflow:"hidden",color:"#65748b",fontFamily:"DM Mono",fontSize:9,whiteSpace:"nowrap"}}>{data.map(item=><span key={item.label}>{item.label}</span>)}</div><small style={{color:"#94a3b8",fontSize:9}}>{unit}</small></div>}
const Kpis=({count=1248}:{count?:number})=><section className="kpis"><Metric icon="◉" label="Active Cameras" value={String(count).padStart(3,"0")} trend="8.2%"/><Metric icon="⌘" label="OCR Accuracy" value="98.4%" trend="1.4%" color="purple"/><Metric icon="▤" label="Plates Scanned" value="45,291" trend="12.6%" color="green"/></section>;
function App(){
 const mapContainer=useRef<HTMLDivElement|null>(null),mapRef=useRef<Map|null>(null); const [cameras,setCameras]=useState<Camera[]>([]),[cameraHealth,setCameraHealth]=useState<CameraHealth[]>([]),[routes,setRoutes]=useState<CameraRoute[]>([]),[realtimeTrajectory,setRealtimeTrajectory]=useState<RealtimeTrajectory|null>(null),[alerts,setAlerts]=useState<Alert[]>([]),[alertsLoading,setAlertsLoading]=useState(true),[alertsError,setAlertsError]=useState<string|null>(null),[analyticsSummary,setAnalyticsSummary]=useState<AnalyticsSummary|null>(null),[analyticsLoading,setAnalyticsLoading]=useState(true),[analyticsError,setAnalyticsError]=useState<string|null>(null),[congestion,setCongestion]=useState<HistoricalCongestion[]>([]),[zones,setZones]=useState<ZoneTraffic[]>([]),[routeTraffic,setRouteTraffic]=useState<RouteTraffic[]>([]),[odMatrix,setOdMatrix]=useState<ODMatrixEntry[]>([]),[chartsLoading,setChartsLoading]=useState(true),[chartsError,setChartsError]=useState<string|null>(null); const [tab,setTab]=useState<Tab>("Live Map"),[search,setSearch]=useState(""),[now,setNow]=useState(new Date()),[mapReady,setMapReady]=useState(false);
 useEffect(()=>{const id=setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(id)},[]);
 useEffect(()=>{fetch("http://127.0.0.1:8000/cameras").then(r=>{if(!r.ok)throw Error("Failed to fetch cameras");return r.json()}).then((d:CamerasResponse)=>setCameras(d.cameras)).catch(e=>console.error("Camera API error:",e))},[]);
 useEffect(()=>{fetch("http://127.0.0.1:8000/cameras/health").then(r=>{if(!r.ok)throw Error("Failed to fetch camera health");return r.json()}).then((d:CameraHealthResponse)=>setCameraHealth(d.cameras)).catch(e=>console.error("Camera health API error:",e))},[]);
 useEffect(()=>{fetch("http://127.0.0.1:8000/camera-routes").then(r=>{if(!r.ok)throw Error("Failed to fetch camera routes");return r.json()}).then((d:CameraRoutesResponse)=>setRoutes(d.routes)).catch(e=>console.error("Camera routes API error:",e))},[]);
 useEffect(()=>{fetch("http://127.0.0.1:8000/alerts").then(r=>{if(!r.ok)throw Error("Failed to fetch alerts");return r.json()}).then((d:AlertsResponse)=>setAlerts(d.alerts)).catch(e=>{console.error("Alerts API error:",e);setAlertsError("Unable to load alerts.")}).finally(()=>setAlertsLoading(false))},[]);
 useEffect(()=>{fetch("http://127.0.0.1:8000/analytics/summary").then(r=>{if(!r.ok)throw Error("Failed to fetch analytics summary");return r.json()}).then((d:AnalyticsSummary)=>setAnalyticsSummary(d)).catch(e=>{console.error("Analytics summary API error:",e);setAnalyticsError("Unable to load analytics summary.")}).finally(()=>setAnalyticsLoading(false))},[]);
 useEffect(()=>{const end=new Date();const start=new Date(end);start.setDate(start.getDate()-7);const congestionUrl=`http://127.0.0.1:8000/analytics/congestion/history?${new URLSearchParams({start_time:start.toISOString(),end_time:end.toISOString()})}`;Promise.all([fetch(congestionUrl).then(r=>{if(!r.ok)throw Error("Failed to fetch congestion history");return r.json() as Promise<HistoricalCongestionResponse>}),fetch("http://127.0.0.1:8000/analytics/traffic/zones").then(r=>{if(!r.ok)throw Error("Failed to fetch zone traffic");return r.json() as Promise<ZoneTrafficResponse>}),fetch("http://127.0.0.1:8000/analytics/traffic/routes").then(r=>{if(!r.ok)throw Error("Failed to fetch route traffic");return r.json() as Promise<RouteTrafficResponse>}),fetch("http://127.0.0.1:8000/analytics/od-matrix").then(r=>{if(!r.ok)throw Error("Failed to fetch OD matrix");return r.json() as Promise<ODMatrixResponse>})]).then(([history,zoneData,routeData,odData])=>{setCongestion(history.congestion);setZones(zoneData.zones);setRouteTraffic(routeData.routes);setOdMatrix(odData.matrix)}).catch(e=>{console.error("Analytics chart API error:",e);setChartsError("Unable to load chart data.")}).finally(()=>setChartsLoading(false))},[]);
 useEffect(()=>{const ws=new WebSocket("ws://127.0.0.1:8000/ws/traffic");ws.onopen=()=>console.log("Realtime WebSocket connected");ws.onmessage=e=>{const d:RealtimeTrajectory=JSON.parse(e.data);console.log("Realtime traffic event:",d);setRealtimeTrajectory(d)};ws.onerror=e=>console.error("WebSocket error:",e);ws.onclose=()=>console.log("Realtime WebSocket disconnected");return()=>ws.close()},[]);
 useEffect(()=>{if(!mapContainer.current)return;setMapReady(false);const map=new Map({container:mapContainer.current,style:{version:8,sources:{osm:{type:"raster",tiles:["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],tileSize:256,attribution:"© OpenStreetMap contributors"}},layers:[{id:"osm",type:"raster",source:"osm",paint:{"raster-brightness-max":.55,"raster-saturation":-.35,"raster-contrast":.08}}]},center:[80.23,13.04],zoom:11});map.on("load",()=>{setMapReady(true);map.resize()});mapRef.current=map;return()=>{setMapReady(false);map.remove();mapRef.current=null}},[tab]);
 useEffect(()=>{const map=mapRef.current;if(!mapReady||!map||!cameras.length||!cameraHealth.length)return;cameras.forEach(c=>{const h=cameraHealth.find(x=>x.camera_id===c.camera_id)?.health_status??"OFFLINE";const color=h==="WARNING"?"#f59e0b":h==="OFFLINE"?"#ef4444":"#10b981";const el=document.createElement("div");el.className="camera-marker";el.style.setProperty("--marker",color);new Marker({element:el}).setLngLat([c.longitude,c.latitude]).setPopup(new Popup({offset:16}).setHTML(`<strong>${c.camera_id}</strong><br/>${c.camera_name}<br/>Health: ${h}<br/>Configured Status: ${c.status}`)).addTo(map)})},[cameras,cameraHealth,tab,mapReady]);
 useEffect(()=>{const map=mapRef.current;if(!mapReady||!map||!routes.length)return;if(map.getSource("camera-routes"))return;map.addSource("camera-routes",{type:"geojson",data:{type:"FeatureCollection",features:routes.map(r=>({type:"Feature" as const,properties:{route_id:r.route_id,starting_node:r.starting_node,ending_node:r.ending_node,total_distance_m:r.total_distance_m},geometry:r.geometry}))}});map.addLayer({id:"camera-routes-line",type:"line",source:"camera-routes",paint:{"line-color":"#3b82f6","line-width":4,"line-opacity":.8,"line-blur":1}})},[routes,tab,mapReady]);useEffect(()=>{if(tab==="Live Map")setTimeout(()=>mapRef.current?.resize(),250)},[tab]);
 const counts=useMemo(()=>({healthy:cameraHealth.filter(c=>c.health_status==="HEALTHY").length,warning:cameraHealth.filter(c=>c.health_status==="WARNING").length,offline:cameraHealth.filter(c=>c.health_status==="OFFLINE").length}),[cameraHealth]); const time=now.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit"});
 const activeAlertCount=alerts.filter(alert=>alert.status.toUpperCase()==="ACTIVE").length;
 return <div className="shell"><aside><div className="brand"><b>N</b><div><strong>NEURAL<span>GRID</span></strong><small>URBAN INTELLIGENCE</small></div></div><label>OPERATIONS</label><nav>{nav.map(([name,icon])=><button className={tab===name?"active":""} onClick={()=>setTab(name)} key={name}><i>{icon}</i>{name}{name==="Alerts"&&activeAlertCount>0&&<em>{activeAlertCount}</em>}</button>)}</nav><div className="health"><label>SYSTEM HEALTH</label><strong><i/>System operational</strong><span>• API online</span><span>• Realtime connected</span><span>• Database online</span></div></aside><main><header><div><p>SMART CITY / COMMAND CENTER</p><h1>{tab}</h1></div><div className="top"><div className="search">⌕<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search plate, camera or route..."/></div><div className="clock">{now.toLocaleDateString([], {month:"short",day:"numeric",year:"numeric"})}<b>{time}</b></div><button className="avatar">AS</button></div></header>
 {tab==="Live Map"&&<><div className="live"><span><i/> REALTIME <b>Connected</b></span><span>LIVE MONITORING · {time}</span></div><Kpis count={cameras.length||1248}/><section className="map panel"><div ref={mapContainer} className="map-canvas"/><div className="district a">ANNA SALAI</div><div className="district b">GUINDY</div><div className="network"><p>CAMERA NETWORK</p><h2>{cameras.length||1248}<small>Total cameras</small></h2>{([["Healthy",counts.healthy||1189,"ok"],["Warning",counts.warning||38,"warn"],["Offline",counts.offline||21,"bad"]] as [string,number,string][]).map(x=><div className="stat" key={x[0]}><span><i className={x[2]}/>{x[0]}</span><b>{x[1]}</b></div>)}</div><div className="movement"><p>Latest movement</p><b>{realtimeTrajectory?.vehicle_id||"Awaiting realtime trajectory"}</b><span>{realtimeTrajectory?`${realtimeTrajectory.from_camera_id} → ${realtimeTrajectory.to_camera_id}`:"Listening for ANPR events…"}</span></div><div className="credit">© OpenStreetMap contributors • MapLibre</div></section></>}
 {tab==="Analytics"&&<Analytics summary={analyticsSummary} loading={analyticsLoading} error={analyticsError} congestion={congestion} zones={zones} routeTraffic={routeTraffic} odMatrix={odMatrix} chartsLoading={chartsLoading} chartsError={chartsError}/>} {tab==="Vehicles"&&<Vehicles search={search}/>} {tab==="Alerts"&&<Alerts alerts={alerts} loading={alertsLoading} error={alertsError} activeCount={activeAlertCount}/>} {tab==="Settings"&&<Settings/>}</main></div>}
 function Analytics({summary,loading,error,congestion,zones,routeTraffic,odMatrix,chartsLoading,chartsError}:{summary:AnalyticsSummary|null;loading:boolean;error:string|null;congestion:HistoricalCongestion[];zones:ZoneTraffic[];routeTraffic:RouteTraffic[];odMatrix:ODMatrixEntry[];chartsLoading:boolean;chartsError:string|null}){const value=(metric:keyof AnalyticsSummary)=>summary?String(summary[metric]):"N/A";const timeLabel=(timestamp:string)=>new Date(timestamp).toLocaleString([],{month:"short",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false});const chronological=[...congestion].sort((a,b)=>new Date(a.time_window_start).getTime()-new Date(b.time_window_start).getTime());const trafficFlow=chronological.map(item=>({label:timeLabel(item.time_window_start),value:item.vehicle_count}));const congestionTrend=chronological.map(item=>({label:timeLabel(item.time_window_start),value:item.average_delay_percent}));const density=zones.map(zone=>({label:`Z${zone.zone_id}`,value:zone.vehicle_count}));const speedUnavailable=routeTraffic.length>0||odMatrix.length>0;const chartState=chartsLoading?"Loading chart data…":chartsError??null;return <>{loading?<div className="panel alerts-state">Loading analytics summary…</div>:error?<div className="panel alerts-state">{error}</div>:<section className="kpis four"><Metric icon="◉" label="Total Cameras" value={value("total_cameras")}/><Metric icon="✓" label="Healthy Cameras" value={value("healthy_cameras")} color="green"/><Metric icon="!" label="Offline Cameras" value={value("offline_cameras")} color="orange"/><Metric icon="△" label="Active Alerts" value={value("active_alerts")} color="purple"/></section>}<section className="charts"><article className="chart panel"><h3>Traffic flow by time window</h3><p>Vehicle count by congestion time window</p>{chartState?<div className="chart-empty">{chartState}</div>:<DataChart data={trafficFlow} color="#3b82f6" unit="Vehicles"/>}</article><article className="chart panel"><h3>Speed variation</h3><p>Requires route distance and travel time</p><div className="chart-empty">{speedUnavailable?"No distance data available":"No data available"}</div></article><article className="chart panel"><h3>Vehicle density</h3><p>Vehicle count by monitored zone</p>{chartState?<div className="chart-empty">{chartState}</div>:<DataChart data={density} color="#10b981" unit="Vehicles by zone"/>}</article><article className="chart panel"><h3>Congestion trend</h3><p>Average delay percentage by time window</p>{chartState?<div className="chart-empty">{chartState}</div>:<DataChart data={congestionTrend} color="#f59e0b" unit="Average delay (%)"/>}</article></section></>}
 function Vehicles({search}:{search:string}){const rows=vehicleRows.filter(v=>v.join(" ").toLowerCase().includes(search.toLowerCase()));return <><section className="kpis four"><Metric icon="▣" label="Vehicles Detected" value="8,542" trend="18.2%"/><Metric icon="↗" label="Speeding Vehicles" value="126" trend="5.8%" color="orange"/><Metric icon="!" label="Abnormal Behavior" value="14" trend="2.3%" color="purple"/><Metric icon="△" label="Route Alerts" value="37" trend="8.0%" color="green"/></section><section className="table panel"><div><h3>Vehicle monitoring</h3><p>Live ANPR observations across the city network</p></div><table><thead><tr>{["Plate number","Vehicle type","Route","Speed","Last seen","Status"].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r[0]}>{r.map((v,i)=><td key={v}>{i===0?<b>{v}</b>:i===5?<span className={v.toLowerCase()}>{v}</span>:v}</td>)}</tr>)}</tbody></table></section></>}
 function Alerts({alerts,loading,error,activeCount}:{alerts:Alert[];loading:boolean;error:string|null;activeCount:number}){if(loading)return <section className="alerts"><div className="title"><div><p>INCIDENT COMMAND</p><h2>Active alerts</h2></div></div><div className="panel alerts-state">Loading alerts…</div></section>;if(error)return <section className="alerts"><div className="title"><div><p>INCIDENT COMMAND</p><h2>Active alerts</h2></div></div><div className="panel alerts-state">{error}</div></section>;return <section className="alerts"><div className="title"><div><p>INCIDENT COMMAND</p><h2>Active alerts {activeCount>0&&<span>{activeCount}</span>}</h2></div><button>Mark all reviewed</button></div>{alerts.length===0?<div className="panel alerts-state">No alerts found.</div>:alerts.map(alert=>{const location=alert.zone_name??alert.camera_name??alert.camera_id??alert.road_id??"N/A";const vehicle=alert.vehicle_id===null?"N/A":String(alert.vehicle_id);const timestamp=alert.detected_at?new Date(alert.detected_at).toLocaleString():"N/A";return <article className={`alert panel ${alert.severity.toLowerCase()}`} key={alert.alert_id}><div><b>{alert.severity.toUpperCase()==="CRITICAL"&&<i/>}{alert.severity}</b><small>{timestamp}</small></div><div><h3>{alert.alert_type}</h3><p>{alert.message||"N/A"}</p><span>⌖ {location}</span></div><strong><small>VEHICLE / PLATE</small>{vehicle}</strong><button>{alert.status||"N/A"}</button></article>})}</section>}
 function Settings(){const items:[string,string,boolean][]=[["Camera network","Monitoring 1,248 city cameras",true],["Live detection","Process ANPR streams in realtime",true],["AI OCR settings","Confidence threshold: 92%",true],["Road rule enforcement","Apply policy-based violations",false],["Alert thresholds","Configure event escalation rules",true],["Integrations","API, webhook & external systems",false]];return <section className="settings">{items.map(x=><article className="setting panel" key={x[0]}><i>{x[0][0]}</i><div><h3>{x[0]}</h3><p>{x[1]}</p></div><button className={x[2]?"toggle on":"toggle"}><b/></button></article>)}<article className="permissions panel"><div><p>ACCESS CONTROL</p><h3>User permissions</h3><span>Manage command-center roles and operational access.</span></div><button>Manage users</button></article></section>}
export default App;
*/}

{/* 
import { useEffect, useMemo, useRef, useState } from "react";
import { Map, Marker, Popup, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./App.css";
import maplibreWorker from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
setWorkerUrl(maplibreWorker);

interface Camera { camera_id:string; camera_name:string; status:string; longitude:number; latitude:number }
interface CamerasResponse { cameras:Camera[] }
interface CameraHealth { camera_id:string; camera_name:string; configured_status:string; last_event_at:string|null; health_status:string; minutes_since_last_event:number|null }
interface CameraHealthResponse { cameras:CameraHealth[] }
interface CameraRoute { route_id:number; starting_node:string; ending_node:string; total_distance_m:number; geometry:{type:"MultiLineString";coordinates:number[][][]} }
interface RealtimeTrajectory { trajectory_id:number; vehicle_id:string; from_camera_id:string; to_camera_id:string; start_event_id:number; end_event_id:number; event_type:string }
interface CameraRoutesResponse { routes:CameraRoute[] }
interface Alert { alert_id:number; alert_type:string; severity:string; message:string; vehicle_id:number|null; road_id:string|null; camera_id:string|null; camera_name:string|null; zone_id:number|null; zone_name:string|null; authority_name:string|null; detected_at:string; resolved_at:string|null; status:string; metadata:unknown|null; created_at:string }
interface AlertsResponse { alerts:Alert[] }
interface AnalyticsSummary { total_cameras:number; healthy_cameras:number; warning_cameras:number; offline_cameras:number; total_alerts:number; active_alerts:number; high_alerts:number; medium_alerts:number; critical_alerts:number }
interface HistoricalCongestion { from_camera_id:string; to_camera_id:string; time_window_start:string; time_window_end:string; vehicle_count:number; baseline_travel_time_seconds:number; average_travel_time_seconds:number; average_delay_seconds:number; average_delay_percent:number; congestion_level:string }
interface HistoricalCongestionResponse { congestion:HistoricalCongestion[] }
interface ZoneTraffic { zone_id:number; zone_name:string; authority_name:string|null; event_count:number; vehicle_count:number }
interface ZoneTrafficResponse { zones:ZoneTraffic[] }
interface RouteTraffic { from_camera_id:string; to_camera_id:string; trajectory_count:number; vehicle_count:number; average_travel_time_seconds:number }
interface RouteTrafficResponse { routes:RouteTraffic[] }
interface ODMatrixEntry { origin:string; destination:string; vehicle_count:number }
interface ODMatrixResponse { matrix:ODMatrixEntry[] }
type Tab="Live Map"|"Analytics"|"Vehicles"|"Alerts"|"Settings";
const nav:[Tab,string][]=[["Live Map","◈"],["Analytics","⌁"],["Vehicles","▣"],["Alerts","△"],["Settings","⚙"]];
const vehicleRows=[["TN 01 AX 4821","Sedan","Anna Salai → Guindy","52 km/h","Just now","Authorized"],["TN 09 BV 1907","SUV","OMR → Perungudi","78 km/h","2 min ago","Flagged"],["TN 22 CP 8824","Truck","Poonamallee → Central","42 km/h","4 min ago","Priority"],["TN 14 DK 5516","Hatchback","Adyar → T. Nagar","64 km/h","6 min ago","Suspicious"]];
function Spark({color="#3b82f6"}:{color?:string}) {return <svg className="spark" viewBox="0 0 150 45" preserveAspectRatio="none"><path d="M0 38 C15 30 19 35 31 25 S48 31 60 18 S81 29 92 15 S112 22 125 8 S141 16 150 4" fill="none" stroke={color} strokeWidth="2.5"/><path d="M0 38 C15 30 19 35 31 25 S48 31 60 18 S81 29 92 15 S112 22 125 8 S141 16 150 4 L150 45 L0 45Z" fill={color} opacity=".1"/></svg>}
function Metric({icon,label,value,trend,color="blue"}:{icon:string;label:string;value:string;trend?:string;color?:string}) {return <article className="metric panel"><i className={color}>{icon}</i><div><p>{label}</p><h2>{value}</h2>{trend&&<span>↗ {trend} <small>vs last week</small></span>}</div><Spark color={color==="purple"?"#8b5cf6":color==="green"?"#10b981":color==="orange"?"#f59e0b":"#3b82f6"}/></article>}
function DataChart({data,color,unit}:{data:{label:string;value:number}[];color:string;unit:string}){if(!data.length)return <div className="chart-empty">No data available</div>;const max=Math.max(...data.map(item=>item.value),1);const points=data.map((item,index)=>`${index*(240/Math.max(data.length-1,1))},${92-(item.value/max)*72}`).join(" ");return <div style={{position:"absolute",left:18,right:18,bottom:18,height:120}}><svg viewBox="0 0 240 100" preserveAspectRatio="none" style={{width:"100%",height:96,overflow:"visible"}}><polyline points={points} fill="none" stroke={color} strokeWidth="3" vectorEffect="non-scaling-stroke"/>{data.map((item,index)=><circle key={item.label} cx={index*(240/Math.max(data.length-1,1))} cy={92-(item.value/max)*72} r="3" fill={color}/>)}</svg><div style={{display:"flex",justifyContent:"space-between",gap:6,overflow:"hidden",color:"#65748b",fontFamily:"DM Mono",fontSize:9,whiteSpace:"nowrap"}}>{data.map(item=><span key={item.label}>{item.label}</span>)}</div><small style={{color:"#94a3b8",fontSize:9}}>{unit}</small></div>}
const Kpis=({total,healthy,offline}:{total:number;healthy:number;offline:number})=><section className="kpis"><Metric icon="◉" label="Total Cameras" value={String(total)} color="blue"/><Metric icon="✓" label="Healthy Cameras" value={String(healthy)} color="green"/><Metric icon="!" label="Offline Cameras" value={String(offline)} color="orange"/></section>;
function App(){
 const mapContainer=useRef<HTMLDivElement|null>(null),mapRef=useRef<Map|null>(null); const [cameras,setCameras]=useState<Camera[]>([]),[cameraHealth,setCameraHealth]=useState<CameraHealth[]>([]),[routes,setRoutes]=useState<CameraRoute[]>([]),[realtimeTrajectory,setRealtimeTrajectory]=useState<RealtimeTrajectory|null>(null),[alerts,setAlerts]=useState<Alert[]>([]),[alertsLoading,setAlertsLoading]=useState(true),[alertsError,setAlertsError]=useState<string|null>(null),[analyticsSummary,setAnalyticsSummary]=useState<AnalyticsSummary|null>(null),[analyticsLoading,setAnalyticsLoading]=useState(true),[analyticsError,setAnalyticsError]=useState<string|null>(null),[congestion,setCongestion]=useState<HistoricalCongestion[]>([]),[zones,setZones]=useState<ZoneTraffic[]>([]),[routeTraffic,setRouteTraffic]=useState<RouteTraffic[]>([]),[odMatrix,setOdMatrix]=useState<ODMatrixEntry[]>([]),[chartsLoading,setChartsLoading]=useState(true),[chartsError,setChartsError]=useState<string|null>(null); const [tab,setTab]=useState<Tab>("Live Map"),[search,setSearch]=useState(""),[now,setNow]=useState(new Date()),[mapReady,setMapReady]=useState(false);
 useEffect(()=>{const id=setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(id)},[]);
 useEffect(()=>{fetch("http://127.0.0.1:8000/cameras").then(r=>{if(!r.ok)throw Error("Failed to fetch cameras");return r.json()}).then((d:CamerasResponse)=>setCameras(d.cameras)).catch(e=>console.error("Camera API error:",e))},[]);
 useEffect(()=>{fetch("http://127.0.0.1:8000/cameras/health").then(r=>{if(!r.ok)throw Error("Failed to fetch camera health");return r.json()}).then((d:CameraHealthResponse)=>setCameraHealth(d.cameras)).catch(e=>console.error("Camera health API error:",e))},[]);
 useEffect(()=>{fetch("http://127.0.0.1:8000/camera-routes").then(r=>{if(!r.ok)throw Error("Failed to fetch camera routes");return r.json()}).then((d:CameraRoutesResponse)=>setRoutes(d.routes)).catch(e=>console.error("Camera routes API error:",e))},[]);
 useEffect(()=>{fetch("http://127.0.0.1:8000/alerts").then(r=>{if(!r.ok)throw Error("Failed to fetch alerts");return r.json()}).then((d:AlertsResponse)=>setAlerts(d.alerts)).catch(e=>{console.error("Alerts API error:",e);setAlertsError("Unable to load alerts.")}).finally(()=>setAlertsLoading(false))},[]);
 useEffect(()=>{fetch("http://127.0.0.1:8000/analytics/summary").then(r=>{if(!r.ok)throw Error("Failed to fetch analytics summary");return r.json()}).then((d:AnalyticsSummary)=>setAnalyticsSummary(d)).catch(e=>{console.error("Analytics summary API error:",e);setAnalyticsError("Unable to load analytics summary.")}).finally(()=>setAnalyticsLoading(false))},[]);
 useEffect(()=>{const end=new Date();const start=new Date(end);start.setDate(start.getDate()-7);const congestionUrl=`http://127.0.0.1:8000/analytics/congestion/history?${new URLSearchParams({start_time:start.toISOString(),end_time:end.toISOString()})}`;Promise.all([fetch(congestionUrl).then(r=>{if(!r.ok)throw Error("Failed to fetch congestion history");return r.json() as Promise<HistoricalCongestionResponse>}),fetch("http://127.0.0.1:8000/analytics/traffic/zones").then(r=>{if(!r.ok)throw Error("Failed to fetch zone traffic");return r.json() as Promise<ZoneTrafficResponse>}),fetch("http://127.0.0.1:8000/analytics/traffic/routes").then(r=>{if(!r.ok)throw Error("Failed to fetch route traffic");return r.json() as Promise<RouteTrafficResponse>}),fetch("http://127.0.0.1:8000/analytics/od-matrix").then(r=>{if(!r.ok)throw Error("Failed to fetch OD matrix");return r.json() as Promise<ODMatrixResponse>})]).then(([history,zoneData,routeData,odData])=>{setCongestion(history.congestion);setZones(zoneData.zones);setRouteTraffic(routeData.routes);setOdMatrix(odData.matrix)}).catch(e=>{console.error("Analytics chart API error:",e);setChartsError("Unable to load chart data.")}).finally(()=>setChartsLoading(false))},[]);
 useEffect(()=>{const ws=new WebSocket("ws://127.0.0.1:8000/ws/traffic");ws.onopen=()=>console.log("Realtime WebSocket connected");ws.onmessage=e=>{const d:RealtimeTrajectory=JSON.parse(e.data);console.log("Realtime traffic event:",d);setRealtimeTrajectory(d)};ws.onerror=e=>console.error("WebSocket error:",e);ws.onclose=()=>console.log("Realtime WebSocket disconnected");return()=>ws.close()},[]);
 useEffect(()=>{if(!mapContainer.current)return;setMapReady(false);const map=new Map({container:mapContainer.current,style:{version:8,sources:{osm:{type:"raster",tiles:["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],tileSize:256,attribution:"© OpenStreetMap contributors"}},layers:[{id:"osm",type:"raster",source:"osm",paint:{"raster-brightness-max":.55,"raster-saturation":-.35,"raster-contrast":.08}}]},center:[80.23,13.04],zoom:11});map.on("load",()=>{setMapReady(true);map.resize()});mapRef.current=map;return()=>{setMapReady(false);map.remove();mapRef.current=null}},[tab]);
 useEffect(()=>{const map=mapRef.current;if(!mapReady||!map||!cameras.length||!cameraHealth.length)return;cameras.forEach(c=>{const h=cameraHealth.find(x=>x.camera_id===c.camera_id)?.health_status??"OFFLINE";const color=h==="WARNING"?"#f59e0b":h==="OFFLINE"?"#ef4444":"#10b981";const el=document.createElement("div");el.className="camera-marker";el.style.setProperty("--marker",color);new Marker({element:el}).setLngLat([c.longitude,c.latitude]).setPopup(new Popup({offset:16}).setHTML(`<strong>${c.camera_id}</strong><br/>${c.camera_name}<br/>Health: ${h}<br/>Configured Status: ${c.status}`)).addTo(map)})},[cameras,cameraHealth,tab,mapReady]);
 useEffect(()=>{const map=mapRef.current;if(!mapReady||!map||!routes.length)return;if(map.getSource("camera-routes"))return;map.addSource("camera-routes",{type:"geojson",data:{type:"FeatureCollection",features:routes.map(r=>({type:"Feature" as const,properties:{route_id:r.route_id,starting_node:r.starting_node,ending_node:r.ending_node,total_distance_m:r.total_distance_m},geometry:r.geometry}))}});map.addLayer({id:"camera-routes-line",type:"line",source:"camera-routes",paint:{"line-color":"#3b82f6","line-width":4,"line-opacity":.8,"line-blur":1}})},[routes,tab,mapReady]);useEffect(()=>{if(tab==="Live Map")setTimeout(()=>mapRef.current?.resize(),250)},[tab]);
 const counts=useMemo(()=>({healthy:cameraHealth.filter(c=>c.health_status==="HEALTHY").length,warning:cameraHealth.filter(c=>c.health_status==="WARNING").length,offline:cameraHealth.filter(c=>c.health_status==="OFFLINE").length}),[cameraHealth]); const time=now.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit"});
 const activeAlertCount=alerts.filter(alert=>alert.status.toUpperCase()==="ACTIVE").length;
 return <div className="shell"><aside><div className="brand"><b>N</b><div><strong>NEURAL<span>GRID</span></strong><small>URBAN INTELLIGENCE</small></div></div><label>OPERATIONS</label><nav>{nav.map(([name,icon])=><button className={tab===name?"active":""} onClick={()=>setTab(name)} key={name}><i>{icon}</i>{name}{name==="Alerts"&&activeAlertCount>0&&<em>{activeAlertCount}</em>}</button>)}</nav><div className="health"><label>SYSTEM HEALTH</label><strong><i/>System operational</strong><span>• API online</span><span>• Realtime connected</span><span>• Database online</span></div></aside><main><header><div><p>SMART CITY / COMMAND CENTER</p><h1>{tab}</h1></div><div className="top"><div className="search">⌕<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search plate, camera or route..."/></div><div className="clock">{now.toLocaleDateString([], {month:"short",day:"numeric",year:"numeric"})}<b>{time}</b></div><button className="avatar">AS</button></div></header>
 {tab==="Live Map"&&<><div className="live"><span><i/> REALTIME <b>Connected</b></span><span>LIVE MONITORING · {time}</span></div><Kpis total={cameras.length} healthy={counts.healthy} offline={counts.offline}/><section className="map panel"><div ref={mapContainer} className="map-canvas"/><div className="district a">ANNA SALAI</div><div className="district b">GUINDY</div><div className="network"><p>CAMERA NETWORK</p><h2>{cameras.length}<small>Total cameras</small></h2>{([["Healthy",counts.healthy,"ok"],["Warning",counts.warning,"warn"],["Offline",counts.offline,"bad"]] as [string,number,string][]).map(x=><div className="stat" key={x[0]}><span><i className={x[2]}/>{x[0]}</span><b>{x[1]}</b></div>)}</div><div className="movement"><p>Latest movement</p><b>{realtimeTrajectory?.vehicle_id||"Awaiting realtime trajectory"}</b><span>{realtimeTrajectory?`${realtimeTrajectory.from_camera_id} → ${realtimeTrajectory.to_camera_id}`:"Listening for ANPR events…"}</span></div><div className="credit">© OpenStreetMap contributors • MapLibre</div></section></>}
 {tab==="Analytics"&&<Analytics summary={analyticsSummary} cameraCounts={counts} loading={analyticsLoading} error={analyticsError} congestion={congestion} zones={zones} routeTraffic={routeTraffic} odMatrix={odMatrix} chartsLoading={chartsLoading} chartsError={chartsError}/>} {tab==="Vehicles"&&<Vehicles search={search}/>} {tab==="Alerts"&&<Alerts alerts={alerts} loading={alertsLoading} error={alertsError} activeCount={activeAlertCount}/>} {tab==="Settings"&&<Settings/>}</main></div>}
 function Analytics({summary,cameraCounts,loading,error,congestion,zones,routeTraffic,odMatrix,chartsLoading,chartsError}:{summary:AnalyticsSummary|null;cameraCounts:{healthy:number;warning:number;offline:number};loading:boolean;error:string|null;congestion:HistoricalCongestion[];zones:ZoneTraffic[];routeTraffic:RouteTraffic[];odMatrix:ODMatrixEntry[];chartsLoading:boolean;chartsError:string|null}){const value=(metric:keyof AnalyticsSummary)=>summary?String(summary[metric]):"N/A";const cameraValue=(metric:"total_cameras"|"healthy_cameras"|"offline_cameras")=>metric==="total_cameras"?String(cameraCounts.healthy+cameraCounts.warning+cameraCounts.offline):metric==="healthy_cameras"?String(cameraCounts.healthy):String(cameraCounts.offline);const timeLabel=(timestamp:string)=>new Date(timestamp).toLocaleString([],{month:"short",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false});const chronological=[...congestion].sort((a,b)=>new Date(a.time_window_start).getTime()-new Date(b.time_window_start).getTime());const trafficFlow=chronological.map(item=>({label:timeLabel(item.time_window_start),value:item.vehicle_count}));const congestionTrend=chronological.map(item=>({label:timeLabel(item.time_window_start),value:item.average_delay_percent}));const density=zones.map(zone=>({label:`Z${zone.zone_id}`,value:zone.vehicle_count}));const speedUnavailable=routeTraffic.length>0||odMatrix.length>0;const chartState=chartsLoading?"Loading chart data…":chartsError??null;return <>{loading?<div className="panel alerts-state">Loading analytics summary…</div>:error?<div className="panel alerts-state">{error}</div>:<section className="kpis four"><Metric icon="◉" label="Total Cameras" value={cameraValue("total_cameras")}/><Metric icon="✓" label="Healthy Cameras" value={cameraValue("healthy_cameras")} color="green"/><Metric icon="!" label="Offline Cameras" value={cameraValue("offline_cameras")} color="orange"/><Metric icon="△" label="Active Alerts" value={value("active_alerts")} color="purple"/></section>}<section className="charts"><article className="chart panel"><h3>Traffic flow by time window</h3><p>Vehicle count by congestion time window</p>{chartState?<div className="chart-empty">{chartState}</div>:<DataChart data={trafficFlow} color="#3b82f6" unit="Vehicles"/>}</article><article className="chart panel"><h3>Speed variation</h3><p>Requires route distance and travel time</p><div className="chart-empty">{speedUnavailable?"No distance data available":"No data available"}</div></article><article className="chart panel"><h3>Vehicle density</h3><p>Vehicle count by monitored zone</p>{chartState?<div className="chart-empty">{chartState}</div>:<DataChart data={density} color="#10b981" unit="Vehicles by zone"/>}</article><article className="chart panel"><h3>Congestion trend</h3><p>Average delay percentage by time window</p>{chartState?<div className="chart-empty">{chartState}</div>:<DataChart data={congestionTrend} color="#f59e0b" unit="Average delay (%)"/>}</article></section></>}
 function Vehicles({search}:{search:string}){const rows=vehicleRows.filter(v=>v.join(" ").toLowerCase().includes(search.toLowerCase()));return <><section className="kpis four"><Metric icon="▣" label="Vehicles Detected" value="8,542" trend="18.2%"/><Metric icon="↗" label="Speeding Vehicles" value="126" trend="5.8%" color="orange"/><Metric icon="!" label="Abnormal Behavior" value="14" trend="2.3%" color="purple"/><Metric icon="△" label="Route Alerts" value="37" trend="8.0%" color="green"/></section><section className="table panel"><div><h3>Vehicle monitoring</h3><p>Live ANPR observations across the city network</p></div><table><thead><tr>{["Plate number","Vehicle type","Route","Speed","Last seen","Status"].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r[0]}>{r.map((v,i)=><td key={v}>{i===0?<b>{v}</b>:i===5?<span className={v.toLowerCase()}>{v}</span>:v}</td>)}</tr>)}</tbody></table></section></>}
 function Alerts({alerts,loading,error,activeCount}:{alerts:Alert[];loading:boolean;error:string|null;activeCount:number}){if(loading)return <section className="alerts"><div className="title"><div><p>INCIDENT COMMAND</p><h2>Active alerts</h2></div></div><div className="panel alerts-state">Loading alerts…</div></section>;if(error)return <section className="alerts"><div className="title"><div><p>INCIDENT COMMAND</p><h2>Active alerts</h2></div></div><div className="panel alerts-state">{error}</div></section>;return <section className="alerts"><div className="title"><div><p>INCIDENT COMMAND</p><h2>Active alerts {activeCount>0&&<span>{activeCount}</span>}</h2></div><button>Mark all reviewed</button></div>{alerts.length===0?<div className="panel alerts-state">No alerts found.</div>:alerts.map(alert=>{const location=alert.zone_name??alert.camera_name??alert.camera_id??alert.road_id??"N/A";const vehicle=alert.vehicle_id===null?"N/A":String(alert.vehicle_id);const timestamp=alert.detected_at?new Date(alert.detected_at).toLocaleString():"N/A";return <article className={`alert panel ${alert.severity.toLowerCase()}`} key={alert.alert_id}><div><b>{alert.severity.toUpperCase()==="CRITICAL"&&<i/>}{alert.severity}</b><small>{timestamp}</small></div><div><h3>{alert.alert_type}</h3><p>{alert.message||"N/A"}</p><span>⌖ {location}</span></div><strong><small>VEHICLE / PLATE</small>{vehicle}</strong><button>{alert.status||"N/A"}</button></article>})}</section>}
 function Settings(){const items:[string,string,boolean][]=[["Camera network","Monitoring 1,248 city cameras",true],["Live detection","Process ANPR streams in realtime",true],["AI OCR settings","Confidence threshold: 92%",true],["Road rule enforcement","Apply policy-based violations",false],["Alert thresholds","Configure event escalation rules",true],["Integrations","API, webhook & external systems",false]];return <section className="settings">{items.map(x=><article className="setting panel" key={x[0]}><i>{x[0][0]}</i><div><h3>{x[0]}</h3><p>{x[1]}</p></div><button className={x[2]?"toggle on":"toggle"}><b/></button></article>)}<article className="permissions panel"><div><p>ACCESS CONTROL</p><h3>User permissions</h3><span>Manage command-center roles and operational access.</span></div><button>Manage users</button></article></section>}
export default App;
*/}


import { useEffect, useMemo, useRef, useState } from "react";
import { Map, Marker, Popup, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./App.css";
import maplibreWorker from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
setWorkerUrl(maplibreWorker);

interface Camera { camera_id:string; camera_name:string; status:string; longitude:number; latitude:number }
interface CamerasResponse { cameras:Camera[] }
interface CameraHealth { camera_id:string; camera_name:string; configured_status:string; last_event_at:string|null; health_status:string; minutes_since_last_event:number|null }
interface CameraHealthResponse { cameras:CameraHealth[] }
interface CameraRoute { route_id:number; starting_node:string; ending_node:string; total_distance_m:number; geometry:{type:"MultiLineString";coordinates:number[][][]} }
interface RealtimeTrajectory { trajectory_id:number; vehicle_id:string; from_camera_id:string; to_camera_id:string; start_event_id:number; end_event_id:number; event_type:string }
interface CameraRoutesResponse { routes:CameraRoute[] }
interface Alert { alert_id:number; alert_type:string; severity:string; message:string; vehicle_id:number|null; road_id:string|null; camera_id:string|null; camera_name:string|null; zone_id:number|null; zone_name:string|null; authority_name:string|null; detected_at:string; resolved_at:string|null; status:string; metadata:unknown|null; created_at:string }
interface AlertsResponse { alerts:Alert[] }
interface AnalyticsSummary { total_cameras:number; healthy_cameras:number; warning_cameras:number; offline_cameras:number; total_alerts:number; active_alerts:number; high_alerts:number; medium_alerts:number; critical_alerts:number }
interface HistoricalCongestion { from_camera_id:string; to_camera_id:string; time_window_start:string; time_window_end:string; vehicle_count:number; baseline_travel_time_seconds:number; average_travel_time_seconds:number; average_delay_seconds:number; average_delay_percent:number; congestion_level:string }
interface HistoricalCongestionResponse { congestion:HistoricalCongestion[] }
interface ZoneTraffic { zone_id:number; zone_name:string; authority_name:string|null; event_count:number; vehicle_count:number }
interface ZoneTrafficResponse { zones:ZoneTraffic[] }
interface RouteTraffic { from_camera_id:string; to_camera_id:string; trajectory_count:number; vehicle_count:number; average_travel_time_seconds:number }
interface RouteTrafficResponse { routes:RouteTraffic[] }
interface ODMatrixEntry { origin:string; destination:string; vehicle_count:number }
interface ODMatrixResponse { matrix:ODMatrixEntry[] }
interface VehicleTrajectory { trajectory_id:number; vehicle_id:number; from_camera_id:string; to_camera_id:string; started_at:string; ended_at:string; travel_time_seconds:number; distance_m:number; road_sequence:unknown; geometry:unknown; inference_method:string; confidence:number|null; prev_trajectory_id:number|null; next_trajectory_id:number|null }
interface VehicleTrajectoryResponse { vehicle_id:number; trajectory:VehicleTrajectory[] }
interface VehicleRow { vehicle_id:number; from_camera_id:string; to_camera_id:string; route:string; travel_time_seconds:number|null; distance_m:number|null; last_seen:string|null; status:string }
type Tab="Live Map"|"Analytics"|"Vehicles"|"Alerts"|"Settings";
const nav:[Tab,string][]=[["Live Map","◈"],["Analytics","⌁"],["Vehicles","▣"],["Alerts","△"],["Settings","⚙"]];
function Spark({color="#3b82f6"}:{color?:string}) {return <svg className="spark" viewBox="0 0 150 45" preserveAspectRatio="none"><path d="M0 38 C15 30 19 35 31 25 S48 31 60 18 S81 29 92 15 S112 22 125 8 S141 16 150 4" fill="none" stroke={color} strokeWidth="2.5"/><path d="M0 38 C15 30 19 35 31 25 S48 31 60 18 S81 29 92 15 S112 22 125 8 S141 16 150 4 L150 45 L0 45Z" fill={color} opacity=".1"/></svg>}
function Metric({icon,label,value,trend,color="blue"}:{icon:string;label:string;value:string;trend?:string;color?:string}) {return <article className="metric panel"><i className={color}>{icon}</i><div><p>{label}</p><h2>{value}</h2>{trend&&<span>↗ {trend} <small>vs last week</small></span>}</div><Spark color={color==="purple"?"#8b5cf6":color==="green"?"#10b981":color==="orange"?"#f59e0b":"#3b82f6"}/></article>}
function DataChart({data,color,unit}:{data:{label:string;value:number}[];color:string;unit:string}){if(!data.length)return <div className="chart-empty">No data available</div>;const max=Math.max(...data.map(item=>item.value),1);const points=data.map((item,index)=>`${index*(240/Math.max(data.length-1,1))},${92-(item.value/max)*72}`).join(" ");return <div style={{position:"absolute",left:18,right:18,bottom:18,height:120}}><svg viewBox="0 0 240 100" preserveAspectRatio="none" style={{width:"100%",height:96,overflow:"visible"}}><polyline points={points} fill="none" stroke={color} strokeWidth="3" vectorEffect="non-scaling-stroke"/>{data.map((item,index)=><circle key={item.label} cx={index*(240/Math.max(data.length-1,1))} cy={92-(item.value/max)*72} r="3" fill={color}/>)}</svg><div style={{display:"flex",justifyContent:"space-between",gap:6,overflow:"hidden",color:"#65748b",fontFamily:"DM Mono",fontSize:9,whiteSpace:"nowrap"}}>{data.map(item=><span key={item.label}>{item.label}</span>)}</div><small style={{color:"#94a3b8",fontSize:9}}>{unit}</small></div>}
const Kpis=({total,healthy,offline}:{total:number;healthy:number;offline:number})=><section className="kpis"><Metric icon="◉" label="Total Cameras" value={String(total)} color="blue"/><Metric icon="✓" label="Healthy Cameras" value={String(healthy)} color="green"/><Metric icon="!" label="Offline Cameras" value={String(offline)} color="orange"/></section>;
function App(){
 const mapContainer=useRef<HTMLDivElement|null>(null),mapRef=useRef<Map|null>(null),markersRef=useRef<Marker[]>([]); const [cameras,setCameras]=useState<Camera[]>([]),[cameraHealth,setCameraHealth]=useState<CameraHealth[]>([]),[routes,setRoutes]=useState<CameraRoute[]>([]),[realtimeTrajectory,setRealtimeTrajectory]=useState<RealtimeTrajectory|null>(null),[latestLiveAlert,setLatestLiveAlert]=useState<Alert|null>(null),[vehicleTrajectories,setVehicleTrajectories]=useState<Record<number,VehicleTrajectory[]>>({}),[vehicleLoading,setVehicleLoading]=useState(false),[alerts,setAlerts]=useState<Alert[]>([]),[alertsLoading,setAlertsLoading]=useState(true),[alertsError,setAlertsError]=useState<string|null>(null),[analyticsSummary,setAnalyticsSummary]=useState<AnalyticsSummary|null>(null),[analyticsLoading,setAnalyticsLoading]=useState(true),[analyticsError,setAnalyticsError]=useState<string|null>(null),[congestion,setCongestion]=useState<HistoricalCongestion[]>([]),[zones,setZones]=useState<ZoneTraffic[]>([]),[routeTraffic,setRouteTraffic]=useState<RouteTraffic[]>([]),[odMatrix,setOdMatrix]=useState<ODMatrixEntry[]>([]),[chartsLoading,setChartsLoading]=useState(true),[chartsError,setChartsError]=useState<string|null>(null); const [tab,setTab]=useState<Tab>("Live Map"),[search,setSearch]=useState(""),[now,setNow]=useState(new Date()),[mapReady,setMapReady]=useState(false);
 useEffect(()=>{const id=setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(id)},[]);
 useEffect(()=>{fetch("http://127.0.0.1:8000/cameras").then(r=>{if(!r.ok)throw Error("Failed to fetch cameras");return r.json()}).then((d:CamerasResponse)=>setCameras(d.cameras)).catch(e=>console.error("Camera API error:",e))},[]);
 useEffect(()=>{fetch("http://127.0.0.1:8000/cameras/health").then(r=>{if(!r.ok)throw Error("Failed to fetch camera health");return r.json()}).then((d:CameraHealthResponse)=>setCameraHealth(d.cameras)).catch(e=>console.error("Camera health API error:",e))},[]);
 useEffect(()=>{fetch("http://127.0.0.1:8000/camera-routes").then(r=>{if(!r.ok)throw Error("Failed to fetch camera routes");return r.json()}).then((d:CameraRoutesResponse)=>setRoutes(d.routes)).catch(e=>console.error("Camera routes API error:",e))},[]);
 useEffect(()=>{fetch("http://127.0.0.1:8000/alerts").then(r=>{if(!r.ok)throw Error("Failed to fetch alerts");return r.json()}).then((d:AlertsResponse)=>setAlerts(d.alerts)).catch(e=>{console.error("Alerts API error:",e);setAlertsError("Unable to load alerts.")}).finally(()=>setAlertsLoading(false))},[]);
 useEffect(()=>{const vehicleIds=Array.from(new Set(alerts.map(a=>a.vehicle_id).filter((id):id is number=>id!==null)));if(!vehicleIds.length){setVehicleTrajectories({});setVehicleLoading(false);return}setVehicleLoading(true);Promise.all(vehicleIds.map(async vehicleId=>{try{const r=await fetch(`http://127.0.0.1:8000/vehicles/${vehicleId}/trajectory`);if(!r.ok)throw Error(`Vehicle ${vehicleId} trajectory unavailable`);const d:VehicleTrajectoryResponse=await r.json();return [vehicleId,d.trajectory] as const}catch(e){console.error(`Vehicle ${vehicleId} trajectory API error:`,e);return [vehicleId,[]] as const}})).then(entries=>setVehicleTrajectories(Object.fromEntries(entries))).finally(()=>setVehicleLoading(false))},[alerts]);
 useEffect(()=>{fetch("http://127.0.0.1:8000/analytics/summary").then(r=>{if(!r.ok)throw Error("Failed to fetch analytics summary");return r.json()}).then((d:AnalyticsSummary)=>setAnalyticsSummary(d)).catch(e=>{console.error("Analytics summary API error:",e);setAnalyticsError("Unable to load analytics summary.")}).finally(()=>setAnalyticsLoading(false))},[]);
 useEffect(()=>{const end=new Date();const start=new Date(end);start.setDate(start.getDate()-7);const congestionUrl=`http://127.0.0.1:8000/analytics/congestion/history?${new URLSearchParams({start_time:start.toISOString(),end_time:end.toISOString()})}`;Promise.all([fetch(congestionUrl).then(r=>{if(!r.ok)throw Error("Failed to fetch congestion history");return r.json() as Promise<HistoricalCongestionResponse>}),fetch("http://127.0.0.1:8000/analytics/traffic/zones").then(r=>{if(!r.ok)throw Error("Failed to fetch zone traffic");return r.json() as Promise<ZoneTrafficResponse>}),fetch("http://127.0.0.1:8000/analytics/traffic/routes").then(r=>{if(!r.ok)throw Error("Failed to fetch route traffic");return r.json() as Promise<RouteTrafficResponse>}),fetch("http://127.0.0.1:8000/analytics/od-matrix").then(r=>{if(!r.ok)throw Error("Failed to fetch OD matrix");return r.json() as Promise<ODMatrixResponse>})]).then(([history,zoneData,routeData,odData])=>{setCongestion(history.congestion);setZones(zoneData.zones);setRouteTraffic(routeData.routes);setOdMatrix(odData.matrix)}).catch(e=>{console.error("Analytics chart API error:",e);setChartsError("Unable to load chart data.")}).finally(()=>setChartsLoading(false))},[]);
 useEffect(()=>{
  const ws=new WebSocket("ws://127.0.0.1:8000/ws/traffic");
  ws.onopen=()=>console.log("Realtime WebSocket connected");
  ws.onmessage=e=>{
   try{
    const d=JSON.parse(e.data);
    const eventType=d.event_type||(d.from_camera_id&&d.to_camera_id?"TRAJECTORY_CREATED":"UNKNOWN");
    if(eventType==="TRAJECTORY_CREATED"){
     setRealtimeTrajectory(d as RealtimeTrajectory);
    }else if(eventType==="ALERT_CREATED"){
     const newAlert:Alert={
      alert_id:d.alert_id,
      alert_type:d.alert_type||"INCIDENT",
      severity:d.severity||"MEDIUM",
      message:d.message||d.description||"New traffic incident detected",
      vehicle_id:d.vehicle_id!==undefined?d.vehicle_id:null,
      road_id:d.road_id?String(d.road_id):null,
      camera_id:d.camera_id?String(d.camera_id):null,
      camera_name:d.camera_name||null,
      zone_id:d.zone_id!==undefined?d.zone_id:null,
      zone_name:d.zone_name||null,
      authority_name:d.authority_name||null,
      detected_at:d.detected_at||new Date().toISOString(),
      resolved_at:d.resolved_at||null,
      status:d.status||"ACTIVE",
      metadata:d.metadata||null,
      created_at:d.created_at||new Date().toISOString()
     };
     setAlerts(prev=>[newAlert,...prev.filter(a=>a.alert_id!==newAlert.alert_id)]);
     setLatestLiveAlert(newAlert);
     if(newAlert.vehicle_id){
      fetch(`http://127.0.0.1:8000/vehicles/${newAlert.vehicle_id}/trajectory`)
       .then(r=>r.ok?r.json():null)
       .then(vt=>{if(vt&&vt.trajectory)setVehicleTrajectories(prev=>({...prev,[newAlert.vehicle_id!]:vt.trajectory}))})
       .catch(err=>console.error("Error fetching vehicle trajectory for new alert:",err));
     }
    }else if(eventType==="CAMERA_HEALTH_UPDATED"){
     if(Array.isArray(d.cameras)){
      setCameraHealth(prev=>{
       const record:Record<string,CameraHealth>={};
       for(const c of prev) record[c.camera_id]=c;
       for(const ch of d.cameras){
        const existing=record[ch.camera_id];
        record[ch.camera_id]={
         camera_id:ch.camera_id,
         camera_name:ch.camera_name||existing?.camera_name||ch.camera_id,
         configured_status:existing?.configured_status||"ACTIVE",
         last_event_at:ch.last_event_at||existing?.last_event_at||null,
         health_status:ch.health_status||"OFFLINE",
         minutes_since_last_event:ch.minutes_since_last_event??existing?.minutes_since_last_event??null
        };
       }
       return Object.values(record);
      });
     }
    }else if(eventType==="CONGESTION_UPDATED"){
     if(Array.isArray(d.congestion)){
      setCongestion(prev=>{
       const record:Record<string,HistoricalCongestion>={};
       for(const item of prev){
        record[`${item.from_camera_id}-${item.to_camera_id}-${item.time_window_start}`]=item;
       }
       for(const item of d.congestion){
        record[`${item.from_camera_id}-${item.to_camera_id}-${item.time_window_start}`]=item;
       }
       return Object.values(record);
      });
     }
    }
   }catch(err){
    console.error("Failed to parse realtime WebSocket message:",err);
   }
  };
  ws.onerror=e=>console.error("WebSocket error:",e);
  ws.onclose=()=>console.log("Realtime WebSocket disconnected");
  return()=>ws.close();
 },[]);
 useEffect(()=>{if(!mapContainer.current)return;setMapReady(false);const map=new Map({container:mapContainer.current,style:{version:8,sources:{osm:{type:"raster",tiles:["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],tileSize:256,attribution:"© OpenStreetMap contributors"}},layers:[{id:"osm",type:"raster",source:"osm",paint:{"raster-brightness-max":.55,"raster-saturation":-.35,"raster-contrast":.08}}]},center:[80.23,13.04],zoom:11});map.on("load",()=>{setMapReady(true);map.resize()});mapRef.current=map;return()=>{setMapReady(false);map.remove();mapRef.current=null}},[tab]);
 useEffect(()=>{
  const map=mapRef.current;
  if(!mapReady||!map||!cameras.length||!cameraHealth.length)return;
  markersRef.current.forEach(m=>m.remove());
  markersRef.current=[];
  cameras.forEach(c=>{
   const h=cameraHealth.find(x=>x.camera_id===c.camera_id)?.health_status??"OFFLINE";
   const color=h==="WARNING"?"#f59e0b":h==="OFFLINE"?"#ef4444":"#10b981";
   const el=document.createElement("div");
   el.className="camera-marker";
   el.style.setProperty("--marker",color);
   const marker=new Marker({element:el}).setLngLat([c.longitude,c.latitude]).setPopup(new Popup({offset:16}).setHTML(`<strong>${c.camera_id}</strong><br/>${c.camera_name}<br/>Health: ${h}<br/>Configured Status: ${c.status}`)).addTo(map);
   markersRef.current.push(marker);
  });
  return()=>{markersRef.current.forEach(m=>m.remove());markersRef.current=[]};
 },[cameras,cameraHealth,tab,mapReady]);
 useEffect(()=>{const map=mapRef.current;if(!mapReady||!map||!routes.length)return;if(map.getSource("camera-routes"))return;map.addSource("camera-routes",{type:"geojson",data:{type:"FeatureCollection",features:routes.map(r=>({type:"Feature" as const,properties:{route_id:r.route_id,starting_node:r.starting_node,ending_node:r.ending_node,total_distance_m:r.total_distance_m},geometry:r.geometry}))}});map.addLayer({id:"camera-routes-line",type:"line",source:"camera-routes",paint:{"line-color":"#3b82f6","line-width":4,"line-opacity":.8,"line-blur":1}})},[routes,tab,mapReady]);useEffect(()=>{if(tab==="Live Map")setTimeout(()=>mapRef.current?.resize(),250)},[tab]);
 const counts=useMemo(()=>({healthy:cameraHealth.filter(c=>c.health_status==="HEALTHY").length,warning:cameraHealth.filter(c=>c.health_status==="WARNING").length,offline:cameraHealth.filter(c=>c.health_status==="OFFLINE").length}),[cameraHealth]); const time=now.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit"});
 const activeAlertCount=alerts.filter(alert=>alert.status.toUpperCase()==="ACTIVE").length;
 return <div className="shell"><aside><div className="brand"><b>N</b><div><strong>NEURAL<span>GRID</span></strong><small>URBAN INTELLIGENCE</small></div></div><label>OPERATIONS</label><nav>{nav.map(([name,icon])=><button className={tab===name?"active":""} onClick={()=>setTab(name)} key={name}><i>{icon}</i>{name}{name==="Alerts"&&activeAlertCount>0&&<em>{activeAlertCount}</em>}</button>)}</nav><div className="health"><label>SYSTEM HEALTH</label><strong><i/>System operational</strong><span>• API online</span><span>• Realtime connected</span><span>• Database online</span></div></aside><main><header><div><p>SMART CITY / COMMAND CENTER</p><h1>{tab}</h1></div><div className="top"><div className="search">⌕<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search plate, camera or route..."/></div><div className="clock">{now.toLocaleDateString([], {month:"short",day:"numeric",year:"numeric"})}<b>{time}</b></div><button className="avatar">AS</button></div></header>
 {tab==="Live Map"&&<><div className="live"><span><i/> REALTIME <b>Connected</b></span><span>LIVE MONITORING · {time}</span></div><Kpis total={cameras.length} healthy={counts.healthy} offline={counts.offline}/><section className="map panel"><div ref={mapContainer} className="map-canvas"/><div className="district a">ANNA SALAI</div><div className="district b">GUINDY</div><div className="network"><p>CAMERA NETWORK</p><h2>{cameras.length}<small>Total cameras</small></h2>{([["Healthy",counts.healthy,"ok"],["Warning",counts.warning,"warn"],["Offline",counts.offline,"bad"]] as [string,number,string][]).map(x=><div className="stat" key={x[0]}><span><i className={x[2]}/>{x[0]}</span><b>{x[1]}</b></div>)}</div><div className="movement"><p>Latest movement</p><b>{realtimeTrajectory?.vehicle_id||"Awaiting realtime trajectory"}</b><span>{realtimeTrajectory?`${realtimeTrajectory.from_camera_id} → ${realtimeTrajectory.to_camera_id}`:"Listening for ANPR events…"}</span>{latestLiveAlert&&<div style={{marginTop:"8px",paddingTop:"6px",borderTop:"1px solid rgba(255,255,255,0.1)",fontSize:"11px",color:latestLiveAlert.severity.toUpperCase()==="CRITICAL"?"#f87171":"#fbbf24"}}><strong>🚨 LIVE ALERT:</strong> {latestLiveAlert.alert_type} ({latestLiveAlert.camera_id||`Vehicle #${latestLiveAlert.vehicle_id}`})</div>}</div><div className="credit">© OpenStreetMap contributors • MapLibre</div></section></>}
 {tab==="Analytics"&&
 <Analytics summary={analyticsSummary} cameraCounts={counts} loading={analyticsLoading} error={analyticsError} congestion={congestion} zones={zones} routeTraffic={routeTraffic} odMatrix={odMatrix} chartsLoading={chartsLoading} chartsError={chartsError}/>
 } {tab==="Vehicles"&&<Vehicles search={search} alerts={alerts} vehicleTrajectories={vehicleTrajectories} cameras={cameras} now={now} vehicleLoading={vehicleLoading}/>} {tab==="Alerts"&&<Alerts alerts={alerts} loading={alertsLoading} error={alertsError} activeCount={activeAlertCount}/>} {tab==="Settings"&&<Settings/>}</main></div>}
 function Analytics({
  summary,
  cameraCounts,
  loading,
  error,
  congestion,
  zones,
  routeTraffic,
  odMatrix,
  chartsLoading,
  chartsError
}: {
  summary: AnalyticsSummary | null;
  cameraCounts: {
    healthy: number;
    warning: number;
    offline: number;
  };
  loading: boolean;
  error: string | null;
  congestion: HistoricalCongestion[];
  zones: ZoneTraffic[];
  routeTraffic: RouteTraffic[];
  odMatrix: ODMatrixEntry[];
  chartsLoading: boolean;
  chartsError: string | null;
}) {
  const value = (metric: keyof AnalyticsSummary) =>
    summary ? String(summary[metric]) : "N/A";
  const [selectedZone, setSelectedZone] = useState<ZoneTraffic | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<RouteTraffic | null>(null);
  const [selectedOD, setSelectedOD] =
  useState<ODMatrixEntry | null>(null);
  const cameraValue = (
    metric: "total_cameras" | "healthy_cameras" | "offline_cameras"
  ) =>
    metric === "total_cameras"
      ? String(
          cameraCounts.healthy +
            cameraCounts.warning +
            cameraCounts.offline
        )
      : metric === "healthy_cameras"
      ? String(cameraCounts.healthy)
      : String(cameraCounts.offline);

  const timeLabel = (timestamp: string) =>
    new Date(timestamp).toLocaleString([], {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });

  const formatDuration = (seconds: number) => {
    if (!Number.isFinite(seconds)) return "N/A";

    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    }

    const minutes = Math.round(seconds / 60);

    if (minutes < 60) {
      return `${minutes} min`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    return remainingMinutes
      ? `${hours}h ${remainingMinutes}m`
      : `${hours}h`;
  };

  const chronological = [...congestion].sort(
    (a, b) =>
      new Date(a.time_window_start).getTime() -
      new Date(b.time_window_start).getTime()
  );

  const trafficFlow = chronological.map((item) => ({
    label: timeLabel(item.time_window_start),
    value: item.vehicle_count
  }));

  const congestionTrend = chronological.map((item) => ({
    label: timeLabel(item.time_window_start),
    value: item.average_delay_percent
  }));

  const zoneDensity = [...zones].sort(
    (a, b) => b.vehicle_count - a.vehicle_count
  );

  const density = zoneDensity.map((zone) => ({
    label: zone.zone_name.split(" ")[0],
    value: zone.vehicle_count
  }));

  const routePerformance = [...routeTraffic]
    .sort((a, b) => b.trajectory_count - a.trajectory_count)
    .slice(0, 8);

  const odFlows = [...odMatrix]
    .sort((a, b) => b.vehicle_count - a.vehicle_count)
    .slice(0, 8);

  const chartState = chartsLoading
    ? "Loading chart data…"
    : chartsError ?? null;

  return (
    <>
      {loading ? (
        <div className="panel alerts-state">
          Loading analytics summary…
        </div>
      ) : error ? (
        <div className="panel alerts-state">{error}</div>
      ) : (
        <section className="kpis four">
          <Metric
            icon="◉"
            label="Total Cameras"
            value={cameraValue("total_cameras")}
          />

          <Metric
            icon="✓"
            label="Healthy Cameras"
            value={cameraValue("healthy_cameras")}
            color="green"
          />

          <Metric
            icon="!"
            label="Offline Cameras"
            value={cameraValue("offline_cameras")}
            color="orange"
          />

          <Metric
            icon="△"
            label="Active Alerts"
            value={value("active_alerts")}
            color="purple"
          />
        </section>
      )}

      <section className="charts">
        <article className="chart panel">
          <h3>Traffic Flow</h3>
          <p>Vehicles observed across 15-minute traffic windows</p>

          {chartState ? (
            <div className="chart-empty">{chartState}</div>
          ) : (
            <DataChart
              data={trafficFlow}
              color="#3b82f6"
              unit="Vehicles"
            />
          )}
        </article>

        <article className="chart panel">
          <h3>Congestion Trend</h3>
          <p>Average delay percentage across monitored routes</p>

          {chartState ? (
            <div className="chart-empty">{chartState}</div>
          ) : (
            <DataChart
              data={congestionTrend}
              color="#f59e0b"
              unit="Average delay (%)"
            />
          )}
        </article>

        <article className="chart panel">
          <h3>Zone Traffic Density</h3>
          <p>Vehicles detected across monitored city zones</p>

          {chartState ? (
            <div className="chart-empty">{chartState}</div>
          ) : zoneDensity.length === 0 ? (
            <div className="chart-empty">
              No zone traffic data available
            </div>
          ) : (
            <DataChart
              data={density}
              color="#10b981"
              unit="Vehicles"
            />
          )}
        </article>

        <article className="chart panel">
          <h3>Route Performance</h3>
          <p>
            Most active camera-to-camera movements by trajectory count
          </p>

          {routePerformance.length === 0 ? (
            <div className="chart-empty">
              No route traffic data available
            </div>
          ) : (
            <div className="analytics-list">
              {routePerformance.map((route) => (
                <div
                    className={`analytics-row ${
                      selectedRoute?.from_camera_id === route.from_camera_id &&
                      selectedRoute?.to_camera_id === route.to_camera_id
                        ? "selected"
                        : ""
                    }`}
                    key={`${route.from_camera_id}-${route.to_camera_id}`}
                    onClick={() => setSelectedRoute(route)}
                  >
                  <div>
                    <strong>
                      {route.from_camera_id} → {route.to_camera_id}
                    </strong>

                    <span>
                      {route.vehicle_count} vehicles
                    </span>
                  </div>

                  <div className="analytics-row-value">
                    <strong>
                      {route.trajectory_count}
                    </strong>

                    <span>
                      {formatDuration(
                        route.average_travel_time_seconds
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
        {selectedRoute && (
  <article className="panel route-detail-panel">
    <div className="section-heading">
      <div>
        <h3>
          {selectedRoute.from_camera_id} →{" "}
          {selectedRoute.to_camera_id}
        </h3>
        <p>Selected route investigation</p>
      </div>

      <button
        className="zone-detail-close"
        onClick={() => setSelectedRoute(null)}
      >
        ×
      </button>
    </div>

    <div className="zone-detail-grid">
      <div className="zone-detail-stat">
        <span>Trajectories</span>
        <strong>{selectedRoute.trajectory_count}</strong>
      </div>

      <div className="zone-detail-stat">
        <span>Vehicles</span>
        <strong>{selectedRoute.vehicle_count}</strong>
      </div>

      <div className="zone-detail-stat">
        <span>Average Travel Time</span>
        <strong>
          {formatDuration(
            selectedRoute.average_travel_time_seconds
          )}
        </strong>
      </div>

      <div className="zone-detail-stat">
        <span>Route Status</span>
        <strong>
          {selectedRoute.average_travel_time_seconds > 3600
            ? "Outlier"
            : selectedRoute.trajectory_count >= 10
            ? "High Activity"
            : "Normal"}
        </strong>
      </div>
    </div>
  </article>
)}
      </section>

      <section className="analytics-grid">
        <article className="panel analytics-section">
          <div className="section-heading">
            <div>
              <h3>Zone Traffic Analysis</h3>
              <p>
                Vehicle activity, detections and detection density by zone
              </p>
            </div>
          </div>

          {zones.length === 0 ? (
            <div className="chart-empty">
              No zone traffic data available
            </div>
          ) : (
            <div className="analytics-table">
              {zoneDensity.map((zone) => {
                const detectionsPerVehicle =
                  zone.vehicle_count > 0
                    ? zone.event_count / zone.vehicle_count
                    : 0;

                return (
                  <div
                      className={`analytics-table-row ${
                        selectedZone?.zone_id === zone.zone_id
                          ? "selected"
                          : ""
                      }`}
                      key={zone.zone_id}
                      onClick={() => setSelectedZone(zone)}
                    >
                    <div className="analytics-zone">
                      <strong>{zone.zone_name}</strong>

                      <span>
                        {zone.authority_name}
                      </span>
                    </div>

                    <div>
                      <strong>{zone.vehicle_count}</strong>
                      <span>vehicles</span>
                    </div>

                    <div>
                      <strong>{zone.event_count}</strong>
                      <span>detections</span>
                    </div>

                    <div>
                      <strong>
                        {detectionsPerVehicle.toFixed(2)}
                      </strong>
                      <span>events / vehicle</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </article>

        {selectedZone && (
  <article className="panel zone-detail-panel">
    <div className="section-heading">
      <div>
        <h3>{selectedZone.zone_name}</h3>
        <p>{selectedZone.authority_name}</p>
      </div>

      <button
        className="zone-detail-close"
        onClick={() => setSelectedZone(null)}
      >
        ×
      </button>
    </div>

    <div className="zone-detail-grid">
      <div className="zone-detail-stat">
        <span>Vehicles</span>
        <strong>{selectedZone.vehicle_count}</strong>
      </div>

      <div className="zone-detail-stat">
        <span>Detections</span>
        <strong>{selectedZone.event_count}</strong>
      </div>

      <div className="zone-detail-stat">
        <span>Events / Vehicle</span>
        <strong>
          {selectedZone.vehicle_count > 0
            ? (
                selectedZone.event_count /
                selectedZone.vehicle_count
              ).toFixed(2)
            : "0.00"}
        </strong>
      </div>

      <div className="zone-detail-stat">
        <span>Activity</span>
        <strong>
          {selectedZone.vehicle_count === 0
            ? "No Traffic"
            : selectedZone.vehicle_count >= 80
            ? "High"
            : selectedZone.vehicle_count >= 40
            ? "Moderate"
            : "Low"}
        </strong>
      </div>
    </div>
  </article>
)}

        <article className="panel analytics-section">
          <div className="section-heading">
            <div>
              <h3>Origin → Destination Flow</h3>
              <p>
                Most frequently observed camera-to-camera movements
              </p>
            </div>
          </div>

          {odFlows.length === 0 ? (
            <div className="chart-empty">
              No origin-destination data available
            </div>
          ) : (
            <div className="analytics-list">
              {odFlows.map((flow, index) => (
                <div
  className={`analytics-row ${
    selectedOD?.origin === flow.origin &&
    selectedOD?.destination === flow.destination
      ? "selected"
      : ""
  }`}
  key={`${flow.origin}-${flow.destination}-${index}`}
  onClick={() => setSelectedOD(flow)}
>
                  <div>
                    <strong>
                      {flow.origin} → {flow.destination}
                    </strong>

                    <span>
                      Origin to destination movement
                    </span>
                  </div>

                  <div className="analytics-row-value">
                    <strong>{flow.vehicle_count}</strong>
                    <span>vehicles</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        {selectedOD && (
  <article className="panel od-detail-panel">
    <div className="section-heading">
      <div>
        <h3>
          {selectedOD.origin} → {selectedOD.destination}
        </h3>
        <p>Selected origin-destination movement</p>
      </div>

      <button
        className="zone-detail-close"
        onClick={() => setSelectedOD(null)}
      >
        ×
      </button>
    </div>

    <div className="zone-detail-grid">
      <div className="zone-detail-stat">
        <span>Vehicles</span>
        <strong>{selectedOD.vehicle_count}</strong>
      </div>

      <div className="zone-detail-stat">
        <span>Rank</span>
        <strong>
          {odFlows.findIndex(
            (flow) =>
              flow.origin === selectedOD.origin &&
              flow.destination === selectedOD.destination
          ) + 1}
        </strong>
      </div>

      <div className="zone-detail-stat">
        <span>Total Observed Vehicles</span>
        <strong>
          {odMatrix.reduce(
            (total, flow) => total + flow.vehicle_count,
            0
          )}
        </strong>
      </div>

      <div className="zone-detail-stat">
        <span>Flow Share</span>
        <strong>
          {odMatrix.length > 0
            ? (
                (selectedOD.vehicle_count /
                  odMatrix.reduce(
                    (total, flow) => total + flow.vehicle_count,
                    0
                  )) *
                100
              ).toFixed(1)
            : "0.0"}
          %
        </strong>
      </div>
    </div>
  </article>
)}
      </section>
    </>
  );
}
 function Vehicles({search,alerts,vehicleTrajectories,cameras,now,vehicleLoading}:{search:string;alerts:Alert[];vehicleTrajectories:Record<number,VehicleTrajectory[]>;cameras:Camera[];now:Date;vehicleLoading:boolean}){const vehicleIds=useMemo(()=>Array.from(new Set(alerts.map(a=>a.vehicle_id).filter((id):id is number=>id!==null))),[alerts]);const abnormalVehicleIds=useMemo(()=>new Set(alerts.filter(a=>a.alert_type==="ABNORMAL_TRAVEL_TIME"||a.alert_type==="COLLECTIVE_MOVEMENT").map(a=>a.vehicle_id).filter((id):id is number=>id!==null)),[alerts]);const routeAlertCount=alerts.filter(a=>a.alert_type==="ROUTE_DEVIATION").length;const rows=useMemo<VehicleRow[]>(()=>vehicleIds.map(vehicleId=>{const trajectory=vehicleTrajectories[vehicleId]??[];const latest=trajectory.length?[...trajectory].sort((a,b)=>new Date(b.ended_at).getTime()-new Date(a.ended_at).getTime())[0]:null;const vehicleAlerts=alerts.filter(a=>a.vehicle_id===vehicleId);const status=vehicleAlerts.some(a=>a.alert_type==="ABNORMAL_TRAVEL_TIME"||a.alert_type==="COLLECTIVE_MOVEMENT")?"Abnormal":vehicleAlerts.some(a=>a.alert_type==="ROUTE_DEVIATION")?"Route Alert":"Tracked";return{vehicle_id:vehicleId,from_camera_id:latest?.from_camera_id??vehicleAlerts[0]?.camera_id??"N/A",to_camera_id:latest?.to_camera_id??"N/A",route:latest?`${latest.from_camera_id} → ${latest.to_camera_id}`:`${vehicleAlerts[0]?.camera_id??"N/A"} → N/A`,travel_time_seconds:latest?.travel_time_seconds??null,distance_m:latest?.distance_m??null,last_seen:latest?.ended_at??vehicleAlerts[0]?.detected_at??null,status}}),[vehicleIds,vehicleTrajectories,alerts]);const cameraName=(id:string)=>cameras.find(c=>c.camera_id===id)?.camera_name??id;const formatDuration=(seconds:number|null)=>seconds===null?"N/A":seconds<60?`${Math.round(seconds)}s`:`${Math.round(seconds/60)}m`;const formatDistance=(meters:number|null)=>meters===null?"N/A":meters>=1000?`${(meters/1000).toFixed(1)} km`:`${Math.round(meters)} m`;const formatLastSeen=(timestamp:string|null)=>{if(!timestamp)return"N/A";const minutes=Math.max(0,Math.floor((now.getTime()-new Date(timestamp).getTime())/60000));return minutes===0?"Just now":minutes<60?`${minutes} min ago`:new Date(timestamp).toLocaleString([], {month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})};const filtered=rows.filter(row=>`${row.vehicle_id} ${row.route} ${row.from_camera_id} ${row.to_camera_id} ${cameraName(row.from_camera_id)} ${cameraName(row.to_camera_id)} ${row.status}`.toLowerCase().includes(search.toLowerCase()));return <><section className="kpis four"><Metric icon="▣" label="Vehicles Tracked" value={String(vehicleIds.length)}/><Metric icon="!" label="Active Vehicle Alerts" value={String(alerts.filter(a=>a.vehicle_id!==null&&a.status.toUpperCase()==="ACTIVE").length)} color="orange"/><Metric icon="△" label="Abnormal Behavior" value={String(abnormalVehicleIds.size)} color="purple"/><Metric icon="↗" label="Route Alerts" value={String(routeAlertCount)} color="green"/></section><section className="table panel"><div><h3>Vehicle monitoring</h3><p>Real vehicle trajectory and alert data from the city traffic backend</p></div>{vehicleLoading&&<div className="chart-empty">Loading vehicle trajectories…</div>}{!vehicleLoading&&filtered.length===0&&<div className="chart-empty">{rows.length===0?"No vehicle records available from the current backend data.":"No vehicles match your search."}</div>}{!vehicleLoading&&filtered.length>0&&<table><thead><tr>{["Vehicle ID","Last route","Travel time","Distance","Last seen","Status"].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{filtered.map(row=><tr key={row.vehicle_id}><td><b>Vehicle {row.vehicle_id}</b></td><td><b>{row.route}</b><small style={{display:"block",color:"#65748b",marginTop:4}}>{cameraName(row.from_camera_id)} → {cameraName(row.to_camera_id)}</small></td><td>{formatDuration(row.travel_time_seconds)}</td><td>{formatDistance(row.distance_m)}</td><td>{formatLastSeen(row.last_seen)}</td><td><span className={row.status.toLowerCase().replace(" ","-")}>{row.status}</span></td></tr>)}</tbody></table>}</section></>}
 function Alerts({alerts,loading,error,activeCount}:{alerts:Alert[];loading:boolean;error:string|null;activeCount:number}){if(loading)return <section className="alerts"><div className="title"><div><p>INCIDENT COMMAND</p><h2>Active alerts</h2></div></div><div className="panel alerts-state">Loading alerts…</div></section>;if(error)return <section className="alerts"><div className="title"><div><p>INCIDENT COMMAND</p><h2>Active alerts</h2></div></div><div className="panel alerts-state">{error}</div></section>;return <section className="alerts"><div className="title"><div><p>INCIDENT COMMAND</p><h2>Active alerts {activeCount>0&&<span>{activeCount}</span>}</h2></div><button>Mark all reviewed</button></div>{alerts.length===0?<div className="panel alerts-state">No alerts found.</div>:alerts.map(alert=>{const location=alert.zone_name??alert.camera_name??alert.camera_id??alert.road_id??"N/A";const vehicle=alert.vehicle_id===null?"N/A":String(alert.vehicle_id);const timestamp=alert.detected_at?new Date(alert.detected_at).toLocaleString():"N/A";return <article className={`alert panel ${alert.severity.toLowerCase()}`} key={alert.alert_id}><div><b>{alert.severity.toUpperCase()==="CRITICAL"&&<i/>}{alert.severity}</b><small>{timestamp}</small></div><div><h3>{alert.alert_type}</h3><p>{alert.message||"N/A"}</p><span>⌖ {location}</span></div><strong><small>VEHICLE / PLATE</small>{vehicle}</strong><button>{alert.status||"N/A"}</button></article>})}</section>}
 function Settings(){const items:[string,string,boolean][]=[["Camera network","Monitoring 1,248 city cameras",true],["Live detection","Process ANPR streams in realtime",true],["AI OCR settings","Confidence threshold: 92%",true],["Road rule enforcement","Apply policy-based violations",false],["Alert thresholds","Configure event escalation rules",true],["Integrations","API, webhook & external systems",false]];return <section className="settings">{items.map(x=><article className="setting panel" key={x[0]}><i>{x[0][0]}</i><div><h3>{x[0]}</h3><p>{x[1]}</p></div><button className={x[2]?"toggle on":"toggle"}><b/></button></article>)}<article className="permissions panel"><div><p>ACCESS CONTROL</p><h3>User permissions</h3><span>Manage command-center roles and operational access.</span></div><button>Manage users</button></article></section>}
export default App;


