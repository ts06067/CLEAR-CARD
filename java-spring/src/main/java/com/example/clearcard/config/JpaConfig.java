// com/example/clearcard/config/JpaConfig.java
package com.example.clearcard.config;

import jakarta.persistence.EntityManagerFactory;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.autoconfigure.jdbc.DataSourceProperties;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.*;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.orm.jpa.*;
import org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;

import javax.sql.DataSource;
import com.zaxxer.hikari.HikariDataSource;
import java.util.HashMap;

@Configuration
@EnableTransactionManagement
@EnableJpaRepositories(basePackages = "com.example.clearcard")
@EntityScan(basePackages = "com.example.clearcard")
public class JpaConfig {

    @Bean
    @Primary
    @ConfigurationProperties("spring.datasource")
    public DataSourceProperties dataSourceProperties() {
        return new DataSourceProperties();
    }

    @Bean
    @Primary
    public DataSource dataSource(DataSourceProperties props) {
        return props.initializeDataSourceBuilder()
                .type(HikariDataSource.class)
                .build();
    }

    @Bean
    public LocalContainerEntityManagerFactoryBean entityManagerFactory(DataSource dataSource) {
        var vendor = new HibernateJpaVendorAdapter();
        vendor.setGenerateDdl(false);

        var jpaProps = new HashMap<String, Object>();
        jpaProps.put("hibernate.hbm2ddl.auto", "none");
        jpaProps.put("hibernate.dialect", "org.hibernate.dialect.SQLServerDialect");
        jpaProps.put("hibernate.jdbc.time_zone", "UTC");

        var emf = new LocalContainerEntityManagerFactoryBean();
        emf.setJpaVendorAdapter(vendor);
        emf.setPackagesToScan("com.example.clearcard");
        emf.setDataSource(dataSource);
        emf.setJpaPropertyMap(jpaProps);
        return emf;
    }

    @Bean
    public PlatformTransactionManager transactionManager(EntityManagerFactory emf) {
        return new JpaTransactionManager(emf);
    }
}
