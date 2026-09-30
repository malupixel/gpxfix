"use client";
import type * as GeoJSON from "geojson";
import { Map as MapLibreMap, Marker, NavigationControl, type GeoJSONSource, type MapMouseEvent } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import type { RouteCoordinate } from "@/features/routes/route-geometry";
import { finalGeometry, type RouteEditorDocument } from "./model";

const STYLE=process.env.NEXT_PUBLIC_MAP_STYLE_URL||"https://tiles.openfreemap.org/styles/liberty";
export function EditorMap({document:routeDocument,selectedId,onMapClick,onMove,onSelect}:{document:RouteEditorDocument;selectedId:string|null;onMapClick:(value:RouteCoordinate)=>void;onMove:(id:string,value:RouteCoordinate)=>void;onSelect:(id:string|null)=>void}){
  const node=useRef<HTMLDivElement>(null), mapRef=useRef<MapLibreMap|null>(null), callbacks=useRef({onMapClick,onMove,onSelect});
  const documentRef=useRef(routeDocument), selectedRef=useRef(selectedId); const [mapError,setMapError]=useState(false);
  useEffect(()=>{callbacks.current={onMapClick,onMove,onSelect}},[onMapClick,onMove,onSelect]);
  useEffect(()=>{documentRef.current=routeDocument;selectedRef.current=selectedId},[routeDocument,selectedId]);
  useEffect(()=>{if(!node.current)return;const map=new MapLibreMap({container:node.current,style:STYLE,center:[19.15,52.1],zoom:6});mapRef.current=map;map.addControl(new NavigationControl(),"top-right");
    const load=()=>{map.addSource("editor-route",{type:"geojson",data:routeData(documentRef.current)});map.addLayer({id:"editor-route-line",type:"line",source:"editor-route",layout:{"line-cap":"round","line-join":"round"},paint:{"line-color":"#2563eb","line-width":["interpolate",["linear"],["zoom"],5,3,14,7]}});map.addSource("editor-segments",{type:"geojson",data:segmentData(documentRef.current,selectedRef.current)});map.addLayer({id:"editor-segments-hit",type:"line",source:"editor-segments",paint:{"line-width":24,"line-opacity":0}});map.addLayer({id:"editor-selected",type:"line",source:"editor-segments",filter:["==",["get","selected"],true],layout:{"line-cap":"round"},paint:{"line-color":"#f59e0b","line-width":9,"line-opacity":.75}});map.resize();};map.once("load",load);map.on("error",()=>setMapError(true));
    const click=(event:MapMouseEvent)=>{const hit=map.queryRenderedFeatures(event.point,{layers:["editor-segments-hit"]})[0];if(hit?.properties?.id){callbacks.current.onSelect(hit.properties.id);return;}callbacks.current.onSelect(null);callbacks.current.onMapClick([event.lngLat.lng,event.lngLat.lat]);};map.on("click",click);return()=>{mapRef.current=null;map.remove();};},[]);
  useEffect(()=>{const map=mapRef.current;if(!map?.getSource("editor-route"))return;(map.getSource("editor-route") as GeoJSONSource).setData(routeData(routeDocument));(map.getSource("editor-segments") as GeoJSONSource).setData(segmentData(routeDocument,selectedId));},[routeDocument,selectedId]);
  useEffect(()=>{const map=mapRef.current;if(!map)return;const markers=routeDocument.points.map((p,index)=>{const element=document.createElement("button");element.type="button";element.className=`size-4 rounded-full border-2 border-white shadow ${index===0?"bg-emerald-600":index===routeDocument.points.length-1?"bg-red-600":"bg-blue-600"}`;element.title=index===0?"Start":index===routeDocument.points.length-1?"Route end":"Control point";const marker=new Marker({element,draggable:true}).setLngLat(p.coordinate).addTo(map);marker.on("dragend",()=>{const c=marker.getLngLat();callbacks.current.onMove(p.id,[c.lng,c.lat]);});return marker;});return()=>markers.forEach(m=>m.remove());},[routeDocument.points]);
  return <><div ref={node} className="absolute inset-0 size-full bg-slate-200" aria-label="Route editor map"/>{mapError&&<div role="alert" className="absolute left-1/2 top-20 z-10 -translate-x-1/2 rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-800 shadow">Nie udało się załadować części mapy. Sprawdź połączenie i odśwież stronę.</div>}</>;
}
function line(coordinates:RouteCoordinate[]):GeoJSON.Feature<GeoJSON.LineString>{return{type:"Feature",properties:{},geometry:{type:"LineString",coordinates}}}
function collection(features:GeoJSON.Feature[]):GeoJSON.FeatureCollection{return{type:"FeatureCollection",features}}
function routeData(document:RouteEditorDocument):GeoJSON.FeatureCollection{return collection(finalGeometry(document).length>=2?[line(finalGeometry(document))]:[])}
function segmentData(document:RouteEditorDocument,selectedId:string|null):GeoJSON.FeatureCollection{return collection(document.segments.map(s=>({type:"Feature",properties:{id:s.id,selected:s.id===selectedId},geometry:{type:"LineString",coordinates:s.geometry}})))}
