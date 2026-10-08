package pl.routecommunity.api.route;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.OutputKeys;
import javax.xml.transform.dom.DOMSource;
import javax.xml.transform.stream.StreamResult;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.w3c.dom.*;
import pl.routecommunity.api.common.error.ApiException;
import pl.routecommunity.api.storage.FileStorage;

/** Exports persisted version bytes. Downloads never invoke an elevation provider. */
@Service
class GpxExportService {
    private final RouteRepository routes;
    private final RouteVersionRepository versions;
    private final FileStorage storage;
    GpxExportService(RouteRepository routes,RouteVersionRepository versions,FileStorage storage){this.routes=routes;this.versions=versions;this.storage=storage;}
    record Export(byte[] bytes,String filename,boolean elevationAvailable) { }
    @Transactional(readOnly=true)
    Export export(String publicId,Integer versionNumber,boolean elevation,String filename) {
        Route route=active(publicId);
        RouteVersion version=versionNumber==null?route.getCurrentVersion():versions.findByRoute_PublicIdAndVersionNumber(publicId,versionNumber)
                .orElseThrow(()->new ApiException(HttpStatus.NOT_FOUND,"Route version not found"));
        byte[] saved=storage.load(version.getStorageKey());
        try {
            DocumentBuilderFactory factory=DocumentBuilderFactory.newInstance();factory.setNamespaceAware(true);
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl",true);
            factory.setFeature("http://xml.org/sax/features/external-general-entities",false);
            factory.setFeature("http://xml.org/sax/features/external-parameter-entities",false);
            factory.setXIncludeAware(false);factory.setExpandEntityReferences(false);
            factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD,"");factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA,"");
            Document doc=factory.newDocumentBuilder().parse(new ByteArrayInputStream(saved));
            NodeList heights=doc.getElementsByTagNameNS("*","ele");boolean available=heights.getLength()>0;
            if(!elevation)while(heights.getLength()>0){Node point=heights.item(0);point.getParentNode().removeChild(point);}
            NodeList tracks=doc.getElementsByTagNameNS("*","trk");
            for(int i=0;i<tracks.getLength();i++) {
                Element track=(Element)tracks.item(i);
                setTrackText(doc,track,"name",route.getName());
                setTrackText(doc,track,"desc",route.getDescription());
            }
            TransformerFactory transformers=TransformerFactory.newInstance();
            transformers.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING,true);
            transformers.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD,"");transformers.setAttribute(XMLConstants.ACCESS_EXTERNAL_STYLESHEET,"");
            var transformer=transformers.newTransformer();transformer.setOutputProperty(OutputKeys.ENCODING,StandardCharsets.UTF_8.name());
            var out=new ByteArrayOutputStream();transformer.transform(new DOMSource(doc),new StreamResult(out));
            return new Export(out.toByteArray(),filename==null||filename.isBlank()?defaultFilename(route.getName(),version.getVersionNumber()):filename(filename),available);
        } catch(Exception e) {throw new IllegalStateException("Stored GPX cannot be exported",e);}
    }
    @Transactional(readOnly=true)
    Export original(String publicId) {
        Route route=active(publicId);
        if(route.getOriginalUploadStorageKey()==null)throw new ApiException(HttpStatus.NOT_FOUND,"Original upload is not available");
        return new Export(storage.load(route.getOriginalUploadStorageKey()),filename(route.getOriginalUploadFilename()),false);
    }
    private Route active(String publicId){return routes.findByPublicId(publicId).orElseThrow(()->new ApiException(HttpStatus.NOT_FOUND,"Route not found"));}
    private void setTrackText(Document doc,Element track,String name,String text) {
        Element existing=null;
        for(Node node=track.getFirstChild();node!=null;node=node.getNextSibling())if(node instanceof Element e&&name.equals(e.getLocalName())){existing=e;break;}
        if(text==null){if(existing!=null)track.removeChild(existing);return;}
        if(existing==null){
            existing=doc.createElementNS(track.getNamespaceURI(),name);
            Node before=null;
            for(Node node=track.getFirstChild();node!=null;node=node.getNextSibling())if(node instanceof Element e){
                if(name.equals("name")||!java.util.Set.of("name","cmt").contains(e.getLocalName())){before=node;break;}
            }
            track.insertBefore(existing,before);
        }
        existing.setTextContent(text);
    }
    static String defaultFilename(String name,int version) {
        String safe=filename(name);
        String stem=safe.substring(0,safe.length()-4);
        String suffix="-v"+version;
        if(stem.length()>160-suffix.length())stem=stem.substring(0,160-suffix.length()).replaceAll("-+$","");
        return stem+suffix+".gpx";
    }
    static String filename(String value) {
        String plain=Normalizer.normalize(value.replace('ł','l').replace('Ł','L'),Normalizer.Form.NFD).replaceAll("\\p{M}+","").toLowerCase(java.util.Locale.ROOT);
        plain=plain.replaceAll("(?i)\\.gpx$","").replaceAll("[^a-z0-9]+","-").replaceAll("^-+|-+$","");
        if(plain.isBlank())plain="route";
        if(plain.length()>160)plain=plain.substring(0,160).replaceAll("-+$","");
        return plain+".gpx";
    }
}
