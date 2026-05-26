package com.campusbrew.campusbrew_api.config;

import com.campusbrew.campusbrew_api.model.DeliveryPersonnel;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.GeoSpatialIndexType;
import org.springframework.data.mongodb.core.index.GeospatialIndex;
import org.springframework.stereotype.Component;

/**
 * Spring Data MongoDB stopped auto-creating indexes from annotations like
 * {@code @GeoSpatialIndexed} in 3.x (auto-index-creation defaults to {@code false}).
 * Annotations are still metadata, but the indexes themselves have to be created
 * explicitly — which we do here, idempotently, on app startup.
 *
 * Add new {@code ensureIndex} calls here when introducing new indexes; running
 * multiple times is harmless (Mongo treats matching specs as no-ops).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MongoIndexInitializer {

    private final MongoTemplate mongoTemplate;

    @EventListener(ApplicationReadyEvent.class)
    public void ensureIndexes() {
        // 2dsphere on deliveryPersonnel.currentLocation — required for
        // DeliveryAssignmentEngine's $near proximity query. createIndex is
        // idempotent at the Mongo level for matching specs.
        mongoTemplate.indexOps(DeliveryPersonnel.class)
                .createIndex(new GeospatialIndex("currentLocation")
                        .typed(GeoSpatialIndexType.GEO_2DSPHERE));
        log.info("Ensured 2dsphere index on deliveryPersonnel.currentLocation");
    }
}
