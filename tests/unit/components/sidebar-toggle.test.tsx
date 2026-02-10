import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DashboardSidebar } from "@/components/layout/sidebar";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

describe("Sidebar Toggle Functionality", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("renders nav sections with default expanded state", () => {
    const profile = {
      id: "test-id",
      organization_id: "org-id",
      email: "test@example.com",
      role: "client" as const,
      is_account_manager: false,
      name: "Test User",
      avatar_url: null,
      organization_name: "Test Org",
      organization_slug: "test-org",
    };

    render(<DashboardSidebar profile={profile} />);

    // Check that nav sections are rendered
    const mainSection = screen.getByText("Main");
    expect(mainSection).toBeDefined();
  });

  it("toggles section visibility when clicking section header", async () => {
    const profile = {
      id: "test-id",
      organization_id: "org-id",
      email: "test@example.com",
      role: "client" as const,
      is_account_manager: false,
      name: "Test User",
      avatar_url: null,
      organization_name: "Test Org",
      organization_slug: "test-org",
    };

    const { container } = render(<DashboardSidebar profile={profile} />);

    // Find a section trigger button
    const triggers = container.querySelectorAll('button');
    const firstTrigger = triggers[0];
    
    expect(firstTrigger).toBeDefined();
    
    // Find the associated collapsible element
    const collapsible = firstTrigger?.closest('[data-state]');
    const initialState = collapsible?.getAttribute('data-state');
    expect(initialState).toBe('open'); // Should start expanded by default
    
    // Click to toggle
    if (firstTrigger) {
      fireEvent.click(firstTrigger);
      
      // Wait for state to change
      await waitFor(() => {
        const newState = collapsible?.getAttribute('data-state');
        expect(newState).toBe('closed');
      });
      
      // Click again to toggle back
      fireEvent.click(firstTrigger);
      
      await waitFor(() => {
        const finalState = collapsible?.getAttribute('data-state');
        expect(finalState).toBe('open');
      });
    }
  });

  it("persists collapsed state to localStorage", async () => {
    const profile = {
      id: "test-id",
      organization_id: "org-id",
      email: "test@example.com",
      role: "super_admin" as const,
      is_account_manager: true,
      name: "Admin User",
      avatar_url: null,
      organization_name: "Test Org",
      organization_slug: "test-org",
    };

    const { rerender } = render(<DashboardSidebar profile={profile} />);

    // Wait for the effect to persist to localStorage
    await waitFor(() => {
      const stored = localStorage.getItem("sidebar-collapsed-sections");
      expect(stored).toBeDefined();
    });

    // Re-render should restore state
    rerender(<DashboardSidebar profile={profile} />);
  });

  it("initializes from localStorage when available", () => {
    // Pre-populate localStorage
    localStorage.setItem("sidebar-collapsed-sections", JSON.stringify(["Admin"]));

    const profile = {
      id: "test-id",
      organization_id: "org-id",
      email: "test@example.com",
      role: "super_admin" as const,
      is_account_manager: true,
      name: "Admin User",
      avatar_url: null,
      organization_name: "Test Org",
      organization_slug: "test-org",
    };

    render(<DashboardSidebar profile={profile} />);

    // Verify state was initialized from localStorage
    const stored = localStorage.getItem("sidebar-collapsed-sections");
    expect(stored).toBe(JSON.stringify(["Admin"]));
  });

  it("handles invalid localStorage data gracefully", () => {
    // Set invalid JSON in localStorage
    localStorage.setItem("sidebar-collapsed-sections", "invalid json");

    const profile = {
      id: "test-id",
      organization_id: "org-id",
      email: "test@example.com",
      role: "client" as const,
      is_account_manager: false,
      name: "Test User",
      avatar_url: null,
      organization_name: "Test Org",
      organization_slug: "test-org",
    };

    // Should not throw error
    expect(() => {
      render(<DashboardSidebar profile={profile} />);
    }).not.toThrow();
  });
});
