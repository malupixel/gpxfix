import test from "node:test";
import assert from "node:assert/strict";
import { publicRoutePath, routeVersionPath } from "./route-links";
import { withCurrentBranch } from "@/lib/api-client";
import { routeMetadata } from "./route-metadata";
import { activityLink } from "./route-activity";

test("stable variant links preserve legacy main URLs and version identity", () => {
  assert.equal(publicRoutePath("route", "main"), "/route/route");
  assert.equal(publicRoutePath("route", "stable-id"), "/route/route?branch=stable-id");
  assert.equal(routeVersionPath("route", 3, "stable-id"), "/route/route/v/3?branch=stable-id");
  assert.equal(routeVersionPath("route", 3), "/route/route/v/3");
});
test("API branch context applies only to this route and respects explicit overrides", () => {
  const previous=Object.getOwnPropertyDescriptor(globalThis,"window");
  Object.defineProperty(globalThis,"window",{configurable:true,value:{location:{pathname:"/route/abc/v/3",search:"?branch=gravel",origin:"http://localhost"}}});
  try {
    assert.equal(withCurrentBranch("/api/routes/abc/suggestions?includeArchived=true"),"/api/routes/abc/suggestions?includeArchived=true&branch=gravel");
    assert.equal(withCurrentBranch("/api/routes/abc?branch=main"),"/api/routes/abc?branch=main");
    assert.equal(withCurrentBranch("/api/routes/abcd/suggestions"),"/api/routes/abcd/suggestions");
    assert.equal(withCurrentBranch("/api/routes/drawn"),"/api/routes/drawn");
  } finally {if(previous)Object.defineProperty(globalThis,"window",previous);else Reflect.deleteProperty(globalThis,"window");}
});
test("variant SEO canonical and activity links keep branch context", () => {
  const meta=routeMetadata({publicId:"abc",name:"Route",description:null,distanceMeters:1200,elevationGainMeters:0,versionNumber:3,imagePath:"/image.png"},"en",false,"gravel");
  assert.match(String(meta.alternates?.canonical), /\/route\/abc\?branch=gravel$/);
  assert.equal(activityLink("abc",{id:"e",type:"SUGGESTION_CREATED",occurredAt:"now",versionNumber:3,suggestionPublicId:"s",commentPublicId:"c",actorKind:"CONTRIBUTOR",actorName:"A",metadata:{}},"gravel"),"/route/abc/v/3?branch=gravel&suggestion=s#comment-c");
});
