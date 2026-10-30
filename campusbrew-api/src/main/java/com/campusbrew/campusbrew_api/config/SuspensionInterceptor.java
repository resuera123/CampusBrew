package com.campusbrew.campusbrew_api.config;

import com.campusbrew.campusbrew_api.repository.UserRepository;
import com.campusbrew.campusbrew_api.service.JwtService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Turns away API calls from suspended accounts (403), so a suspension takes
 * effect on a session that was already logged in, not only at the next login.
 * Calls without a valid token pass through; the controllers handle those.
 */
@Configuration
@RequiredArgsConstructor
public class SuspensionInterceptor implements HandlerInterceptor, WebMvcConfigurer {

    private final JwtService jwtService;
    private final UserRepository userRepository;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(this).addPathPatterns("/api/**").excludePathPatterns("/api/auth/**");
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
            throws Exception {
        String header = request.getHeader("Authorization");
        if (header == null || !header.startsWith("Bearer ")) return true;

        String userId;
        try {
            userId = jwtService.extractUserId(header.substring(7));
        } catch (RuntimeException e) {
            return true;
        }
        boolean suspended = userRepository.findById(userId).map(u -> u.isSuspended()).orElse(false);
        if (!suspended) return true;

        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType("application/json");
        response.getWriter().write("{\"error\":\"Your account is suspended. Contact CampusBrew support.\",\"suspended\":true}");
        return false;
    }
}
