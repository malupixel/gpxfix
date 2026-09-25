import assert from "node:assert/strict";
import test from "node:test";
import { createSuggestionGeometry, EMPTY_SUGGESTION_FORM, hasSuggestionWork, isSuggestionGeometryComplete } from "./route-page-state";
import { suggestionRequest } from "./suggestion-workspace";

test("note draft maps to the persistent API contract without a status",()=>{
  const geometry=createSuggestionGeometry("note");
  assert.equal(geometry.type,"note");
  if(geometry.type!=="note")return;
  const request=suggestionRequest({...geometry,position:{lng:21,lat:52,distanceMeters:1200,segmentIndex:1,segmentFraction:.2,distanceToRouteMeters:0}},{...EMPTY_SUGGESTION_FORM,authorName:" Kasia ",message:" Water here ",category:"water"});
  assert.deepEqual(request,{type:"NOTE",authorName:"Kasia",description:"Water here",category:"water",tags:[],start:{longitude:21,latitude:52,distanceMeters:1200},end:null,proposedGeometry:null});
  assert.equal("status" in request,false);
});

test("detour draft sends anchors and a complete replacement LineString",()=>{
  const geometry=createSuggestionGeometry("detour");
  assert.equal(geometry.type,"detour");
  if(geometry.type!=="detour")return;
  const position=(lng:number,distanceMeters:number)=>({lng,lat:52,distanceMeters,segmentIndex:0,segmentFraction:0,distanceToRouteMeters:0});
  const request=suggestionRequest({...geometry,start:position(21,100),end:position(22,900),waypoints:[[21.5,52.1]]},{...EMPTY_SUGGESTION_FORM,authorName:"Marek",message:"Safer",tags:["safer"]});
  assert.deepEqual(request.proposedGeometry?.coordinates,[[21,52],[21.5,52.1],[22,52]]);
  assert.equal(request.type,"DETOUR");
});

test("geometry completion is independent from form data",()=>{
  const emptyNote=createSuggestionGeometry("note");
  assert.equal(isSuggestionGeometryComplete(emptyNote),false);
  assert.equal(hasSuggestionWork(emptyNote,EMPTY_SUGGESTION_FORM),false);
  if(emptyNote.type!=="note")return;
  const completeNote={...emptyNote,position:{lng:21,lat:52,distanceMeters:1200,segmentIndex:1,segmentFraction:.2,distanceToRouteMeters:0}};
  assert.equal(isSuggestionGeometryComplete(completeNote),true);
  assert.equal(hasSuggestionWork(completeNote,EMPTY_SUGGESTION_FORM),true);
  assert.equal(hasSuggestionWork(emptyNote,{...EMPTY_SUGGESTION_FORM,message:"Keep this while editing"}),true);
});
