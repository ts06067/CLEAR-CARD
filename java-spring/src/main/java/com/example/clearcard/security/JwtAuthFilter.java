package com.example.clearcard.security;

import io.jsonwebtoken.Claims;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.*;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.io.IOException;

@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends GenericFilter {
    private final JwtUtil jwt;
    private final UserDetailsService uds;

    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain) throws IOException, ServletException {
        var http = (HttpServletRequest) req;
        String h = http.getHeader("Authorization");
        if (StringUtils.hasText(h) && h.startsWith("Bearer ")) {
            String token = h.substring(7);
            try {
                Claims c = jwt.parse(token).getBody();
                String username = c.getSubject();
                UserDetails ud = uds.loadUserByUsername(username);
                var auth = new UsernamePasswordAuthenticationToken(ud, null, ud.getAuthorities());
                SecurityContextHolder.getContext().setAuthentication(auth);
            } catch (Exception ignored) { /* fallthrough as anonymous */ }
        }
        chain.doFilter(req, res);
    }
}
