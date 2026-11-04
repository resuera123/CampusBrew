package com.campusbrew.campusbrew_api.config;

import com.campusbrew.campusbrew_api.model.DasherApplication;
import com.campusbrew.campusbrew_api.model.Referenced;
import com.campusbrew.campusbrew_api.model.Report;
import com.campusbrew.campusbrew_api.model.ShopApplication;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Component;

import java.util.List;

/** Gives reports and applications saved before reference numbers existed one, oldest first. */
@Slf4j
@Component
@RequiredArgsConstructor
public class ReferenceBackfill {

    private final MongoTemplate mongoTemplate;
    private final ReferenceNumbers referenceNumbers;

    @EventListener(ApplicationReadyEvent.class)
    public void backfill() {
        for (Class<? extends Referenced> type : List.of(Report.class, DasherApplication.class, ShopApplication.class)) {
            try {
                Query missing = Query.query(Criteria.where("ref").exists(false))
                        .with(Sort.by(Sort.Direction.ASC, "createdAt"));
                missing.fields().include("_id");
                List<org.bson.Document> ids = mongoTemplate.find(missing, org.bson.Document.class,
                        mongoTemplate.getCollectionName(type));
                String prefix = type.getDeclaredConstructor().newInstance().refPrefix();
                for (org.bson.Document d : ids) {
                    mongoTemplate.updateFirst(Query.query(Criteria.where("_id").is(d.get("_id"))),
                            Update.update("ref", referenceNumbers.next(prefix)), type);
                }
                if (!ids.isEmpty()) log.info("Numbered {} existing {} documents", ids.size(), prefix);
            } catch (ReflectiveOperationException | RuntimeException e) {
                log.warn("Reference backfill for {} failed: {}", type.getSimpleName(), e.getMessage());
            }
        }
    }
}
