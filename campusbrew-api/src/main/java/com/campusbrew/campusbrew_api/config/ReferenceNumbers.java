package com.campusbrew.campusbrew_api.config;

import com.campusbrew.campusbrew_api.model.Referenced;
import lombok.RequiredArgsConstructor;
import org.bson.Document;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.mapping.event.AbstractMongoEventListener;
import org.springframework.data.mongodb.core.mapping.event.BeforeConvertEvent;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Component;

/**
 * Numbers reports, applications and support tickets (RPT-0001, DA-0001, …) with
 * one counter per prefix in the "counters" collection.
 */
@Component
@RequiredArgsConstructor
public class ReferenceNumbers extends AbstractMongoEventListener<Object> {

    private final MongoTemplate mongoTemplate;

    @Override
    public void onBeforeConvert(BeforeConvertEvent<Object> event) {
        if (event.getSource() instanceof Referenced doc && doc.getRef() == null) {
            doc.setRef(next(doc.refPrefix()));
        }
    }

    public String next(String prefix) {
        Document counter = mongoTemplate.findAndModify(
                Query.query(Criteria.where("_id").is(prefix)),
                new Update().inc("seq", 1),
                FindAndModifyOptions.options().upsert(true).returnNew(true),
                Document.class, "counters");
        long seq = counter == null ? 1 : ((Number) counter.get("seq")).longValue();
        return format(prefix, seq);
    }

    static String format(String prefix, long seq) {
        return prefix + "-" + String.format("%04d", seq);
    }
}
