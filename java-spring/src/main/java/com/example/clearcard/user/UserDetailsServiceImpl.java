package com.example.clearcard.user;

import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.*;
import org.springframework.stereotype.Service;

@Service @RequiredArgsConstructor
public class UserDetailsServiceImpl implements UserDetailsService {
    private final UserRepository repo;

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        var u = repo.findByUsername(username).orElseThrow(() -> new UsernameNotFoundException("not found"));
        return User.withUsername(u.getUsername()).password(u.getPasswordHash()).roles("USER").build();
    }
}
