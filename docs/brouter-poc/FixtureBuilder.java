import btools.mapcreator.*;
import org.openstreetmap.osmosis.osmbinary.*;
import java.io.*;
import java.nio.file.*;
import java.util.*;
/** Tiny synthetic PBF -> RD5 via the same importer as upstream MapcreatorTest. */
public class FixtureBuilder {
  static void block(DataOutputStream out, String type, byte[] data) throws Exception {
    Fileformat.Blob blob=Fileformat.Blob.newBuilder().setRaw(com.google.protobuf.ByteString.copyFrom(data)).build();
    Fileformat.BlobHeader header=Fileformat.BlobHeader.newBuilder().setType(type).setDatasize(blob.getSerializedSize()).build();
    out.writeInt(header.getSerializedSize()); header.writeTo(out); blob.writeTo(out);
  }
  public static void main(String[] args) throws Exception {
    File home=new File(args[0]); home.mkdirs();
    File lookup=new File(args[1]); String permission=args[2];
    List<String> strings=Arrays.asList("","highway","residential","surface","asphalt","bicycle",permission);
    Osmformat.StringTable.Builder st=Osmformat.StringTable.newBuilder();
    for(String s:strings) st.addS(com.google.protobuf.ByteString.copyFromUtf8(s));
    Osmformat.PrimitiveGroup.Builder group=Osmformat.PrimitiveGroup.newBuilder();
    // Two public road chains, connected only by a tagged bridge. Ends >5km from bridge.
    for(int i=0;i<123;i++) {
      long lon=Math.round((20.01+i*.0015)*10000000);
      group.addNodes(Osmformat.Node.newBuilder().setId(i+1).setLat(510100000).setLon(lon));
    }
    for(int i=0;i<122;i++) {
      Osmformat.Way.Builder way=Osmformat.Way.newBuilder().setId(1000+i).addKeys(1).addVals(2).addKeys(3).addVals(4)
        .addRefs(i+1).addRefs(1);
      if(i==60) way.addKeys(5).addVals(6);
      group.addWays(way);
    }
    File pbf=new File(home,"fixture.pbf");
    try(DataOutputStream out=new DataOutputStream(new FileOutputStream(pbf))) {
      block(out,"OSMHeader",Osmformat.HeaderBlock.newBuilder().addRequiredFeatures("OsmSchema-V0.6").build().toByteArray());
      block(out,"OSMData",Osmformat.PrimitiveBlock.newBuilder().setStringtable(st).addPrimitivegroup(group).setGranularity(100).build().toByteArray());
    }
    File all=new File(home,"import.brf");
    Files.writeString(all.toPath(),"---context:global\nassign validForBikes true\n---context:way\nassign costfactor 1\n---context:node\nassign initialcost 0\n");
    Map<String,File> dirs=new HashMap<>();
    for(String d:new String[]{"nodes","ways","nodes55","ways55","unodes55","segments4"}) {File f=new File(home,d); f.mkdirs(); dirs.put(d,f);}
    File border=new File(home,"bordernids.dat"), rel=new File(home,"cycleways.dat"), res=new File(home,"restrictions.dat"), bn=new File(home,"bordernodes.dat");
    System.setProperty("avoidMapPolling","true");
    OsmFastCutter.doCut(lookup,dirs.get("nodes"),dirs.get("ways"),dirs.get("nodes55"),dirs.get("ways55"),border,rel,res,all,all,all,pbf,null);
    new PosUnifier().process(dirs.get("nodes55"),dirs.get("unodes55"),border,bn,home.toString(),null);
    new WayLinker().process(dirs.get("unodes55"),dirs.get("ways55"),bn,res,lookup,all,dirs.get("segments4"),"rd5");
  }
}
