package com.campusbrew.campusbrew_api.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * NFR-M2 — API documentation. springdoc builds the OpenAPI description from the
 * controllers: JSON at /v3/api-docs, interactive Swagger UI at /swagger-ui.html.
 * "Authorize" with a JWT from POST /api/auth/login to try protected endpoints.
 */
@Configuration
public class OpenApiConfig {

    private static final String BEARER = "bearerAuth";

    @Bean
    public OpenAPI campusBrewOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("CampusBrew API")
                        .version("2.3")
                        .description("REST API of CampusBrew, the CIT-U campus beverage delivery system "
                                + "(customers, delivery personnel, shop operators and administrators). "
                                + "Real-time events use the WebSocket at /ws, described in SDD v2.3 Section 2.1."))
                .components(new Components().addSecuritySchemes(BEARER, new SecurityScheme()
                        .type(SecurityScheme.Type.HTTP).scheme("bearer").bearerFormat("JWT")))
                .addSecurityItem(new SecurityRequirement().addList(BEARER));
    }
}
