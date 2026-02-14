export type ReviewModerationStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface ReviewRecord {
  reviewId: string;
  orderId: string;
  vendorId: string;
  customerId: string;
  rating: number;
  comment: string;
  moderationStatus: ReviewModerationStatus;
  flaggedReason?: string;
  createdAtIso: string;
}

export interface CreateReviewRequest {
  orderId: string;
  customerId: string;
  rating: number;
  comment: string;
}

export interface VendorReviewSummary {
  vendorId: string;
  averageRating: number;
  totalReviews: number;
  reviews: ReviewRecord[];
}

export type SupportTicketPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type SupportTicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "ESCALATED";

export interface SupportTicketRecord {
  ticketId: string;
  customerId: string;
  orderId?: string;
  subject: string;
  description: string;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  createdAtIso: string;
  updatedAtIso: string;
  adminNotes?: string;
}

export interface CreateSupportTicketRequest {
  customerId: string;
  orderId?: string;
  subject: string;
  description: string;
  priority: SupportTicketPriority;
}
