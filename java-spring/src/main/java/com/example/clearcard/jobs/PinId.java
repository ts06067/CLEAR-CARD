// PinId.java
package com.example.clearcard.jobs;

import lombok.*;
import java.io.Serializable;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PinId implements Serializable {
    private UUID userId;
    private String jobId;
}
