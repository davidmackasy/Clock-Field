import { Home, Calendar, User, FolderOpen, FileText, NotebookPen } from "lucide-react";

export const employeeNavItems = [
  { label: "Home", href: "/employee", icon: Home },
  { label: "Schedule", href: "/employee/schedule", icon: Calendar },
  { label: "Reports", href: "/employee/reports", icon: FolderOpen },
  { label: "Profile", href: "/employee/profile", icon: User },
];

export const employeeCenterAction = {
  label: "Action",
  actionSheet: {
    title: "Choose Action",
    options: [
      {
        label: "Start Work",
        description: "Continue with the regular work submission flow",
        icon: FileText,
        href: "/employee/work-log",
      },
      {
        label: "Field Note",
        description: "Record voice and photos for a site note or walkthrough",
        icon: NotebookPen,
        href: "/employee/field-notes",
      },
    ],
  },
};

export const clientNavItems = [
  { label: "Home", href: "/client", icon: Home },
  { label: "Reports", href: "/client/reports", icon: FolderOpen },
  { label: "Profile", href: "/client/profile", icon: User },
];
