package com.example.clearcard.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Date;
import java.util.Map;

@Component
public class JwtUtil {
    private final Key key;
    private final long ttlMinutes;

    public JwtUtil(@Value("${app.jwt.secret}") String secret,
                   @Value("${app.jwt.ttl-minutes:120}") long ttlMinutes) {
        if (secret == null || secret.isBlank()) {
            throw new IllegalArgumentException("app.jwt.secret is empty or missing");
        }
        byte[] keyBytes;
        if (secret.startsWith("base64:")) {
            keyBytes = Decoders.BASE64.decode(secret.substring(7));
        } else {
            keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        }
        // Ensure >= 256 bits for HS256
        if (keyBytes.length < 32) {
            try {
                keyBytes = MessageDigest.getInstance("SHA-256").digest(keyBytes);
            } catch (Exception e) {
                throw new IllegalStateException("Failed to derive JWT key", e);
            }
        }
        this.key = Keys.hmacShaKeyFor(keyBytes);
        this.ttlMinutes = ttlMinutes;
    }

    public String generate(String username) {
        Instant now = Instant.now();
        return Jwts.builder()
                .setSubject(username)
                .addClaims(Map.of("u", username))
                .setIssuedAt(Date.from(now))
                .setExpiration(Date.from(now.plusSeconds(ttlMinutes * 60)))
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }

    public Jws<Claims> parse(String token) {
        return Jwts.parserBuilder().setSigningKey(key).build().parseClaimsJws(token);
    }
}
