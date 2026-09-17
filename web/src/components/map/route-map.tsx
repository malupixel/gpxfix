"use client";
import { Map as MapLibreMap, type LngLatBoundsLike } from "maplibre-gl";
import { useEffect, useRef } from "react";
import type { RouteData } from "@/types/route";
const defaultStyle="https://tiles.openfreemap.org/styles/liberty";
export function RouteMap({geometry}:{geometry:RouteData["geometry"]}) {
  const container=useRef<HTMLDivElement>(null); const map=useRef<MapLibreMap|null>(null);
  useEffect(()=>{
    if(!container.current||map.current)return;
    const coordinates=geometry.coordinates; if(coordinates.length<2)return;
    const instance=new MapLibreMap({container:container.current,style:process.env.NEXT_PUBLIC_MAP_STYLE_URL||defaultStyle,center:coordinates[0],zoom:10});
    map.current=instance;
    instance.on("load",()=>{
      instance.addSource("route",{type:"geojson",data:{type:"Feature",properties:{},geometry}});
      instance.addLayer({id:"route",type:"line",source:"route",paint:{"line-color":"#047857","line-width":5,"line-opacity":0.9},layout:{"line-cap":"round","line-join":"round"}});
      const unwrapped=unwrapLongitudes(coordinates); let west=unwrapped[0][0],east=west,south=unwrapped[0][1],north=south;
      for(const [lon,lat] of unwrapped){west=Math.min(west,lon);east=Math.max(east,lon);south=Math.min(south,lat);north=Math.max(north,lat);}
      instance.fitBounds([[west,south],[east,north]] as LngLatBoundsLike,{padding:50,maxZoom:16,duration:0});
    });
    return()=>{instance.remove();map.current=null;};
  },[geometry]);
  return <div ref={container} className="h-[60vh] min-h-96 w-full rounded-xl border border-slate-200" aria-label="Interactive route map" />;
}
function unwrapLongitudes(coordinates:[number,number][]):[number,number][]{const result:[number,number][]=[coordinates[0]];for(let i=1;i<coordinates.length;i++){let lon=coordinates[i][0];const previous=result[i-1][0];while(lon-previous>180)lon-=360;while(lon-previous< -180)lon+=360;result.push([lon,coordinates[i][1]]);}return result;}
