import assert from "node:assert/strict";
import test from "node:test";
import { createSuggestionDraft } from "./route-page-state";
import { suggestionRequest } from "./suggestion-workspace";

test("note draft maps to the persistent API contract without a status",()=>{
  const draft=createSuggestionDraft("note");
  assert.equal(draft.type,"note");
  if(draft.type!=="note")return;
  const request=suggestionRequest({...draft,authorName:" Kasia ",message:" Water here ",category:"water",position:{lng:21,lat:52,distanceMeters:1200,segmentIndex:1,segmentFraction:.2,distanceToRouteMeters:0}});
  assert.deepEqual(request,{type:"NOTE",authorName:"Kasia",description:"Water here",category:"water",tags:[],start:{longitude:21,latitude:52,distanceMeters:1200},end:null,proposedGeometry:null});
  assert.equal("status" in request,false);
});

test("detour draft sends anchors and a complete replacement LineString",()=>{
  const draft=createSuggestionDraft("detour");
  assert.equal(draft.type,"detour");
  if(draft.type!=="detour")return;
  const position=(lng:number,distanceMeters:number)=>({lng,lat:52,distanceMeters,segmentIndex:0,segmentFraction:0,distanceToRouteMeters:0});
  const request=suggestionRequest({...draft,authorName:"Marek",message:"Safer",tags:["safer"],start:position(21,100),end:position(22,900),waypoints:[[21.5,52.1]]});
  assert.deepEqual(request.proposedGeometry?.coordinates,[[21,52],[21.5,52.1],[22,52]]);
  assert.equal(request.type,"DETOUR");
});
