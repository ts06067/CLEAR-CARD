package com.example.clearcard.config;

import com.example.clearcard.security.JwtAuthFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {
    private final JwtAuthFilter jwtAuthFilter;
    private final UserDetailsService uds;

    @Bean BCryptPasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(); }

    @Bean
    AuthenticationManager authManager(BCryptPasswordEncoder enc) {
        var provider = new DaoAuthenticationProvider();
        provider.setPasswordEncoder(enc);
        provider.setUserDetailsService(uds);
        return new ProviderManager(provider);
    }

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .cors(c -> {})
                .csrf(c -> c.disable()) // JWT-based; CSRF disabled
                .authorizeHttpRequests(reg -> reg
                        .requestMatchers(
                                "/auth/**",
                                "/swagger-ui/**", "/v3/api-docs/**",
                                // Allow SPA endpoints with and without /api prefix (dev proxy)
                                "/jobs", "/jobs/**",
                                "/api/jobs", "/api/jobs/**",
                                // Optional helper endpoints
                                "/sql", "/api/sql",
                                "/csv", "/api/csv",
                                "/articles", "/api/articles", "/articles/**", "/api/articles/**"
                        ).permitAll()
                        .anyRequest().authenticated()
                )
                // Important: non-blocking JWT filter BEFORE UsernamePasswordAuthenticationFilter
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource() {
        var cfg = new CorsConfiguration();
        cfg.setAllowedOrigins(List.of("http://localhost:5173"));
        cfg.setAllowedMethods(List.of("GET","POST","PUT","DELETE","OPTIONS","PATCH"));
        cfg.setAllowedHeaders(List.of(
                "Authorization","Content-Type","Accept","X-Requested-With",
                "X-Job-Title","X-Job-Config","X-XSRF-TOKEN","X-CSRF-TOKEN"
        ));
        cfg.setAllowCredentials(true);
        var src = new UrlBasedCorsConfigurationSource();
        src.registerCorsConfiguration("/**", cfg);
        return src;
    }
}
