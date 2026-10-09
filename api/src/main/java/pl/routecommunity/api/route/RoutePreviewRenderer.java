package pl.routecommunity.api.route;

import java.awt.*;
import java.awt.geom.Path2D;
import java.awt.geom.Point2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import javax.imageio.ImageIO;
import org.springframework.stereotype.Component;
import pl.routecommunity.api.gpx.GpxTrack;

/** Fully local Java2D PNG composition. No HTTP client, tiles, API credentials or SVG interpolation. */
@Component
class RoutePreviewRenderer {
    static final String STYLE = "preview-local-v2";
    private static final Color GREEN = new Color(52, 225, 158), WHITE = new Color(238, 247, 248);
    private final byte[] fallback = compose("Your next great route", null, null, null);

    byte[] fallback() { return fallback; }

    static String revision(long versionId, String name) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(
                    (STYLE + "\n" + versionId + "\n" + name).getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) { throw new IllegalStateException(e); }
    }

    byte[] render(String name, GpxTrack track, Double distance, Double elevation) {
        return compose(name, RoutePreviewViewport.fit(track), distance, elevation);
    }

    private static byte[] compose(String name, RoutePreviewViewport viewport, Double distance, Double elevation) {
        var image = new BufferedImage(1200, 630, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = image.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
            g.setPaint(new GradientPaint(0, 0, new Color(7, 20, 33), 1200, 630, new Color(14, 43, 53)));
            g.fillRect(0, 0, 1200, 630);
            // Restrict the faint grid to the route area, leaving clean space for thumbnail text.
            g.setColor(new Color(137, 202, 189, 15)); g.setStroke(new BasicStroke(1));
            for (int x = 512; x < 1180; x += 32) g.drawLine(x, 112, x, 536);
            for (int y = 112; y <= 536; y += 32) g.drawLine(512, y, 1180, y);
            g.setColor(new Color(52, 225, 158, 30)); g.drawRoundRect(510, 110, 670, 430, 30, 30);
            brand(g);
            g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 14)); g.setColor(GREEN);
            g.drawString("PLAN  /  TWEAK  /  RIDE", 56, 151);
            g.setColor(WHITE); g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 39));
            List<String> title = wrap(g, name == null || name.isBlank() ? "TweakMyRoute" : name, 414, 4);
            for (int i = 0; i < title.size(); i++) g.drawString(title.get(i), 56, 210 + i * 47);
            stats(g, distance, elevation);
            if (viewport != null) drawRoute(g, viewport);
            else {
                var path = new Path2D.Double();path.moveTo(570,410);path.curveTo(640,370,630,240,710,275);
                path.curveTo(805,320,760,440,880,400);path.curveTo(1020,350,955,200,1105,205);
                stroke(g, path);
                g.setColor(WHITE);g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 18));g.drawString("Your route. Your way.", 710, 492);
            }
            g.setColor(new Color(137, 202, 189, 45)); g.drawLine(56, 564, 1144, 564);
            g.setColor(new Color(159, 188, 192));g.setFont(new Font(Font.SANS_SERIF, Font.PLAIN, 20));
            g.drawString("tweakmyroute.com", 56, 603);
            g.setColor(GREEN);g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 14));g.drawString("MADE FOR THE RIDE", 990, 603);
        } finally { g.dispose(); }
        return png(image);
    }

    private static void brand(Graphics2D g) {
        var mark = new Path2D.Double();mark.moveTo(56,75);mark.lineTo(73,53);mark.lineTo(86,66);mark.lineTo(102,43);mark.lineTo(119,75);
        g.setColor(GREEN);g.setStroke(new BasicStroke(4, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));g.draw(mark);
        g.setColor(WHITE);g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 28));g.drawString("TweakMyRoute", 136, 73);
    }

    private static void stats(Graphics2D g, Double distance, Double elevation) {
        g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 32));g.setColor(WHITE);
        if (distance != null && Double.isFinite(distance) && distance >= 0) {
            g.drawString(String.format(Locale.ROOT, "%.1f km", distance / 1000), 56, 460);
        }
        if (elevation != null && Double.isFinite(elevation) && elevation >= 0) g.drawString("↑ " + Math.round(elevation) + " m", 56, 508);
    }

    private static void drawRoute(Graphics2D g, RoutePreviewViewport viewport) {
        for (var segment : viewport.segments()) {
            var path = new Path2D.Double();var first = segment.getFirst();path.moveTo(first.x, first.y);
            for (int i = 1; i < segment.size(); i++) path.lineTo(segment.get(i).x, segment.get(i).y);
            stroke(g, path);
        }
        var start = viewport.segments().getFirst().getFirst(); var finish = viewport.segments().getLast().getLast();
        boolean shared = start.distance(finish) < 2;
        marker(g, start, true, shared);marker(g, finish, false, shared);
    }
    private static void stroke(Graphics2D g, Path2D path) {
        g.setColor(new Color(52, 225, 158, 24));g.setStroke(new BasicStroke(18, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));g.draw(path);
        g.setColor(new Color(52, 225, 158, 45));g.setStroke(new BasicStroke(11, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));g.draw(path);
        g.setColor(GREEN);g.setStroke(new BasicStroke(5, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));g.draw(path);
    }
    private static void marker(Graphics2D g, Point2D.Double point, boolean start, boolean shared) {
        int x = (int)Math.round(point.x), y = (int)Math.round(point.y);
        Color color = start ? GREEN : new Color(251, 191, 88);
        // Opposite halves of a shared endpoint remain visible on closed loops.
        if (!shared || start) {g.setColor(new Color(7, 20, 33));g.fillOval(x-10,y-10,20,20);}
        g.setColor(color);
        if (shared) g.fillArc(x-7,y-7,14,14,start?90:270,180);
        else g.fillOval(x-7,y-7,14,14);
        g.setColor(color);g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 13));
        String label = start ? "START" : "FINISH";
        int width = g.getFontMetrics().stringWidth(label);
        int labelX = Math.max(516, Math.min(1174-width, x-width/2));
        int labelY = start ? y-17 : y+29;
        g.setColor(new Color(7,20,33,235));g.fillRoundRect(labelX-4,labelY-14,width+8,20,6,6);
        g.setColor(color);g.drawString(label,labelX,labelY);
    }

    /** Raster text is never parsed as markup; wrapping works on code points rather than splitting UTF-16. */
    static List<String> wrap(Graphics2D g, String value, int width, int maxLines) {
        var result = new ArrayList<String>(); String remaining = value.replaceAll("[\\p{Cntrl}\\s]+", " ").strip();
        while (!remaining.isEmpty() && result.size() < maxLines) {
            int[] codePoints = remaining.codePoints().toArray();int length = codePoints.length;
            boolean last = result.size() == maxLines-1;
            while (length > 1 && g.getFontMetrics().stringWidth(new String(codePoints,0,length)+(last && length<codePoints.length ? "…":"")) > width) length--;
            String line = new String(codePoints,0,length);int end = line.length();
            int space = line.lastIndexOf(' ');
            if (length<codePoints.length && space>line.length()/2) {end=space;line=line.substring(0,end);}
            result.add(line.strip()+(last && end<remaining.length()?"…":""));remaining=remaining.substring(end).strip();
        }
        return List.copyOf(result);
    }
    private static byte[] png(BufferedImage image) {
        try { var out = new ByteArrayOutputStream();ImageIO.write(image,"png",out);return out.toByteArray(); }
        catch (IOException e) { throw new IllegalStateException("Cannot encode preview",e); }
    }
}
