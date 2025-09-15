# ---- Build stage
FROM gradle:8.8-jdk21 AS build
WORKDIR /workspace

# cache deps
COPY build.gradle settings.gradle ./
COPY gradle gradle
COPY src src
# (if you use Gradle wrapper, also COPY gradlew and chmod +x)

RUN gradle -q clean bootJar -x test

# ---- Runtime stage
FROM eclipse-temurin:21-jre
WORKDIR /app

# Copy fat jar
COPY --from=build /workspace/build/libs/*.jar app.jar

# Expose HTTP
EXPOSE 8080

# Env for gRPC broker location and GCS credentials (Spring will read these)
ENV MSG_HANDLER_HOST=message-handler \
    MSG_HANDLER_PORT=50051 \
    SPRING_PROFILES_ACTIVE=default \
    # If you use Spring Cloud GCP, this points at the key:
    SPRING_CLOUD_GCP_CREDENTIALS_LOCATION=file:/secrets/gcp/key.json

# Mount /secrets/gcp/key.json via docker-compose bind
ENTRYPOINT ["java","-jar","/app/app.jar"]
