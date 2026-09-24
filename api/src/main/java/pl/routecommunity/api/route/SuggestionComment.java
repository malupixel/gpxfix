package pl.routecommunity.api.route;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name="suggestion_comments")
class SuggestionComment {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(name="public_id",nullable=false,unique=true,length=12) private String publicId;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="suggestion_id",nullable=false) private RouteSuggestion suggestion;
    @Column(name="author_name",nullable=false,length=80) private String authorName;
    @Column(nullable=false,length=2000) private String content;
    @Enumerated(EnumType.STRING) @Column(name="moderation_status",nullable=false,length=16) private ModerationStatus moderationStatus;
    @Column(name="created_at",nullable=false) private Instant createdAt;
    @Column(name="updated_at",nullable=false) private Instant updatedAt;
    protected SuggestionComment() { }
    SuggestionComment(String publicId,RouteSuggestion suggestion,String authorName,String content,Instant now){this.publicId=publicId;this.suggestion=suggestion;this.authorName=authorName;this.content=content;this.moderationStatus=ModerationStatus.PENDING;this.createdAt=now;this.updatedAt=now;}
    void moderate(ModerationStatus target,Instant now){moderationStatus.requirePending();if(target==ModerationStatus.PENDING)throw new IllegalArgumentException("Moderation must publish or reject");moderationStatus=target;updatedAt=now;}
    Long getId(){return id;} String getPublicId(){return publicId;} RouteSuggestion getSuggestion(){return suggestion;} String getAuthorName(){return authorName;} String getContent(){return content;} ModerationStatus getModerationStatus(){return moderationStatus;} Instant getCreatedAt(){return createdAt;} Instant getUpdatedAt(){return updatedAt;}
}
