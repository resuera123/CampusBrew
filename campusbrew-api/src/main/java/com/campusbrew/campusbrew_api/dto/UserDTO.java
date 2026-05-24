package com.campusbrew.campusbrew_api.dto;

import com.campusbrew.campusbrew_api.model.User;
import com.campusbrew.campusbrew_api.model.UserRole;
import com.campusbrew.campusbrew_api.model.VerificationStatus;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class UserDTO {
    private String id;
    private String fullName;
    private String email;
    private UserRole role;
    private VerificationStatus verificationStatus;
    private boolean emailVerified;
    private String schoolEmail;
    private String studentId;
    private String phoneNumber;
    private String profilePicture;
    private String address;
    private String dateOfBirth;

    public static UserDTO fromUser(User user) {
        return UserDTO.builder()
                .id(user.getId())
                .fullName(user.getFullName())
                .email(user.getEmail())
                .role(user.getRole())
                .verificationStatus(user.getVerificationStatus())
                .emailVerified(user.isEmailVerified())
                .schoolEmail(user.getSchoolEmail())
                .studentId(user.getStudentId())
                .phoneNumber(user.getPhoneNumber())
                .profilePicture(user.getProfilePicture())
                .build();
    }
}
