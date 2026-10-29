package com.campusbrew.campusbrew_api.config;

import com.campusbrew.campusbrew_api.model.ChatMessage;
import com.campusbrew.campusbrew_api.model.DeliveryPersonnel;
import com.campusbrew.campusbrew_api.model.ItemSale;
import com.campusbrew.campusbrew_api.model.LocationPing;
import com.campusbrew.campusbrew_api.model.Payment;
import com.campusbrew.campusbrew_api.model.Rating;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.GeoSpatialIndexType;
import org.springframework.data.mongodb.core.index.GeospatialIndex;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.index.PartialIndexFilter;
import org.springframework.stereotype.Component;

import java.util.concurrent.TimeUnit;

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
        // DeliveryAssignmentEngine's $near proximity query.
        mongoTemplate.indexOps(DeliveryPersonnel.class)
                .createIndex(new GeospatialIndex("currentLocation")
                        .typed(GeoSpatialIndexType.GEO_2DSPHERE));
        log.info("Ensured 2dsphere index on deliveryPersonnel.currentLocation");

        // ---- v2.0 (SDD v2.0 §2) ----

        // payments: unique gatewayChargeId (partial — only when present, since order/COD
        // payments have no charge id before Xendit assigns one), plus a user history index.
        mongoTemplate.indexOps(Payment.class).createIndex(
                new Index().on("gatewayChargeId", Sort.Direction.ASC).unique()
                        .partial(PartialIndexFilter.of(
                                new Document("gatewayChargeId", new Document("$type", "string")))));
        mongoTemplate.indexOps(Payment.class).createIndex(
                new Index().on("userId", Sort.Direction.ASC).on("createdAt", Sort.Direction.DESC));

        // ratings: one per (order, rater, ratee); plus lookup by ratee for aggregates.
        mongoTemplate.indexOps(Rating.class).createIndex(
                new Index().on("orderId", Sort.Direction.ASC)
                        .on("raterId", Sort.Direction.ASC)
                        .on("rateeId", Sort.Direction.ASC).unique());
        mongoTemplate.indexOps(Rating.class).createIndex(
                new Index().on("rateeId", Sort.Direction.ASC));

        // chatMessages: history lookup + a 30-day TTL that keeps reported messages
        // (partial filter reported:false).
        mongoTemplate.indexOps(ChatMessage.class).createIndex(
                new Index().on("orderId", Sort.Direction.ASC)
                        .on("channel", Sort.Direction.ASC)
                        .on("createdAt", Sort.Direction.ASC));
        mongoTemplate.indexOps(ChatMessage.class).createIndex(
                new Index().on("createdAt", Sort.Direction.ASC)
                        .expire(30, TimeUnit.DAYS)
                        .partial(PartialIndexFilter.of(new Document("reported", false))));

        // locationPings: 7-day TTL.
        mongoTemplate.indexOps(LocationPing.class).createIndex(
                new Index().on("createdAt", Sort.Direction.ASC).expire(7, TimeUnit.DAYS));

        // itemSales: a shop's sales in a date range (FR-5.5 sales by item / chart).
        mongoTemplate.indexOps(ItemSale.class).createIndex(
                new Index().on("shopId", Sort.Direction.ASC)
                        .on("createdAt", Sort.Direction.ASC));

        log.info("Ensured v2.0 indexes: payments, ratings, chatMessages (TTL 30d), "
                + "locationPings (TTL 7d), itemSales");
    }
}
