package com.example.clearcard.auth;

import com.example.clearcard.security.JwtUtil;
import com.example.clearcard.user.*;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;

record LoginReq(@NotBlank String username, @NotBlank String password) {}
record TokenResp(String token) {}

@Tag(name="Auth")
@RestController @RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {
    private final UserRepository users;
    private final BCryptPasswordEncoder enc;
    private final JwtUtil jwt;

    @PostMapping("/register")
    public ResponseEntity<TokenResp> register(@RequestBody LoginReq req) {
        users.findByUsername(req.username()).ifPresent(u -> { throw new RuntimeException("username exists"); });
        var u = new UserEntity();
        u.setUsername(req.username());
        u.setPasswordHash(enc.encode(req.password()));
        users.save(u);
        return ResponseEntity.ok(new TokenResp(jwt.generate(u.getUsername())));
    }

    @PostMapping("/login")
    public ResponseEntity<TokenResp> login(@RequestBody LoginReq req) {
        var u = users.findByUsername(req.username()).orElseThrow(() -> new RuntimeException("bad credentials"));
        if (!enc.matches(req.password(), u.getPasswordHash())) throw new RuntimeException("bad credentials");
        return ResponseEntity.ok(new TokenResp(jwt.generate(u.getUsername())));
    }
}
