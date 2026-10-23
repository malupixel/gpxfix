import btools.expressions.*;
import java.io.File;
/** Evaluate real BRF bytecode with the pinned engine, not a reimplementation. */
public class ProfileProbe {
  public static void main(String[] args) {
    BExpressionMetaData meta = new BExpressionMetaData();
    BExpressionContextWay way = new BExpressionContextWay(meta);
    BExpressionContextNode node = new BExpressionContextNode(meta);
    meta.readMetaData(new File(args[0]));
    way.parseFile(new File(args[1]), "global");
    node.setForeignContext(way);
    node.parseFile(new File(args[1]), "global");
    BExpressionContext ctx = args[2].equals("node") ? node : way;
    int[] tags = ctx.createNewLookupData();
    for (int i=4; i<args.length; i++) {
      String[] kv = args[i].split("=", 2);
      ctx.addLookupValue(kv[0], kv[1], tags);
    }
    ctx.evaluate(Boolean.parseBoolean(args[3]), ctx.encode(tags));
    if (System.getenv("PROBE_DEBUG") != null) for (String v : new String[]{"publicaccess","vehicleaccess","bikeaccess","directionaccess","badoneway","prohibited","pedestrianblocked","technical","hardblocked","roadcost","surfacecost"}) System.err.println(v+"="+ctx.getVariableValue(v,-99));
    System.out.println(args[2].equals("node") ? node.getInitialcost() : way.getCostfactor());
  }
}
