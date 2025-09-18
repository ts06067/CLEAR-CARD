package com.example.clearcard.auth;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
public class CsrfProbeController {
    @GetMapping({"/csrf", "/auth/csrf"})
    public ResponseEntity<Void> noop() {
        return ResponseEntity.noContent().build(); // 204
    }
}
