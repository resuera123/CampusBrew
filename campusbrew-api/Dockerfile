# syntax=docker/dockerfile:1

# ---- Build ----
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /build

# Resolve dependencies first so this layer is cached while only sources change.
COPY pom.xml .
RUN mvn -B -q dependency:go-offline

COPY src ./src
RUN mvn -B -q clean package -DskipTests

# ---- Runtime ----
# jammy rather than alpine: alpine publishes no arm64 image, so it fails to
# build on Apple Silicon machines.
FROM eclipse-temurin:17-jre-jammy
WORKDIR /app

# Matches the Spring Boot repackaged jar; the *.jar.original is not picked up.
COPY --from=build /build/target/*.jar app.jar

RUN groupadd --system spring && useradd --system --gid spring spring
USER spring

# REST API and the /ws realtime endpoint share this one port.
EXPOSE 8080

ENV SPRING_PROFILES_ACTIVE=prod

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
