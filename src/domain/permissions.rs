//! Roles y permisos puros del panel, sin dependencia de Axum, `SQLx` o Glory RS.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum AdminRole {
    Owner,
    FinanceEditor,
    Auditor,
    Viewer,
}

#[derive(Debug, Clone, Copy, Eq, PartialEq)]
pub enum AdminPermission {
    ReadPanel,
    WriteLedger,
    ReviewLedger,
    ManageContent,
    ManagePaymentMethods,
    ReadAudit,
}

impl AdminPermission {
    #[must_use]
    pub const fn is_allowed(self, role: AdminRole) -> bool {
        match self {
            Self::ReadPanel => matches!(
                role,
                AdminRole::Owner
                    | AdminRole::FinanceEditor
                    | AdminRole::Auditor
                    | AdminRole::Viewer
            ),
            Self::WriteLedger => role.can_write_ledger(),
            Self::ReviewLedger => role.can_review_ledger(),
            Self::ManageContent => role.can_manage_content(),
            Self::ManagePaymentMethods => role.can_manage_payment_methods(),
            Self::ReadAudit => role.can_read_audit(),
        }
    }
}

#[derive(Debug, Clone)]
pub struct AdminActor {
    pub id: uuid::Uuid,
    pub email: String,
    pub role: AdminRole,
}

impl AdminRole {
    #[must_use]
    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "owner" => Some(Self::Owner),
            "finance_editor" => Some(Self::FinanceEditor),
            "auditor" => Some(Self::Auditor),
            "viewer" => Some(Self::Viewer),
            _ => None,
        }
    }

    #[must_use]
    pub const fn can_write_ledger(self) -> bool {
        matches!(self, Self::Owner | Self::FinanceEditor)
    }

    #[must_use]
    pub const fn can_review_ledger(self) -> bool {
        matches!(self, Self::Owner | Self::Auditor)
    }

    #[must_use]
    pub const fn can_manage_content(self) -> bool {
        matches!(self, Self::Owner | Self::FinanceEditor)
    }

    #[must_use]
    pub const fn can_manage_payment_methods(self) -> bool {
        matches!(self, Self::Owner)
    }

    #[must_use]
    pub const fn can_read_audit(self) -> bool {
        matches!(self, Self::Owner | Self::Auditor)
    }
}
