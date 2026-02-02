#!/bin/bash

# Branch Rebase Helper Script
# This script helps maintainers rebase feature branches onto main
#
# Usage: ./scripts/rebase-branches.sh [branch-name]
# If no branch name is provided, it will show the menu

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Branches to rebase in priority order
PRIORITY_BRANCHES=(
  "cursor/support-tickets-user-organization-1807"
  "cursor/staff-admin-menu-access-1785"
  "cursor/html-encoding-sniffer-import-ef00"
  "cursor/service-rates-currency-unit-bd96"
  "cursor/financial-section-pages-7b4e"
  "cursor/support-ticket-management-6945"
  "cursor/admin-user-permissions-a14b"
  "claude/fix-profile-image-upload-1i0qx"
  "cursor/zapier-integration-capability-46d4"
  "cursor/zapier-webhook-test-route-error-b5e1"
  "cursor/admin-staff-user-guide-be97"
  "claude/admin-site-metadata-analytics-AOxA6"
  "cursor/implementation-status-readback-77d0"
)

# Function to print with color
print_color() {
  local color=$1
  shift
  echo -e "${color}$@${NC}"
}

# Function to check if branch exists
branch_exists() {
  git rev-parse --verify "$1" >/dev/null 2>&1
}

# Function to get branch status
get_branch_status() {
  local branch=$1
  local base=$(git merge-base main "$branch" 2>/dev/null || echo "")
  
  if [ -z "$base" ]; then
    echo "No common ancestor"
    return 1
  fi
  
  local ahead=$(git rev-list --count $base..$branch)
  local behind=$(git rev-list --count $base..main)
  
  echo "$ahead commits ahead, $behind commits behind main"
}

# Function to rebase a branch
rebase_branch() {
  local branch=$1
  
  print_color "$YELLOW" "\n=========================================="
  print_color "$YELLOW" "Rebasing: $branch"
  print_color "$YELLOW" "=========================================="
  
  # Fetch latest
  print_color "$GREEN" "Fetching latest changes..."
  git fetch origin
  
  # Check if branch exists
  if ! branch_exists "origin/$branch"; then
    print_color "$RED" "Error: Branch origin/$branch does not exist"
    return 1
  fi
  
  # Show current status
  print_color "$GREEN" "\nCurrent status:"
  get_branch_status "origin/$branch"
  
  # Create local branch if it doesn't exist
  if ! branch_exists "$branch"; then
    print_color "$GREEN" "\nCreating local branch..."
    git checkout -b "$branch" "origin/$branch"
  else
    print_color "$GREEN" "\nChecking out branch..."
    git checkout "$branch"
    git pull origin "$branch"
  fi
  
  # Perform rebase
  print_color "$YELLOW" "\nStarting rebase onto main..."
  if git rebase origin/main; then
    print_color "$GREEN" "\n✅ Rebase successful!"
    print_color "$YELLOW" "\nNext steps:"
    print_color "$YELLOW" "1. Test the changes: npm run build && npm run lint"
    print_color "$YELLOW" "2. Push with force: git push --force-with-lease origin $branch"
    print_color "$YELLOW" "3. Review and merge the PR on GitHub"
    
    read -p "Do you want to push now? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      git push --force-with-lease origin "$branch"
      print_color "$GREEN" "✅ Pushed successfully!"
    fi
  else
    print_color "$RED" "\n❌ Rebase failed with conflicts"
    print_color "$YELLOW" "\nConflicts to resolve:"
    git --no-pager diff --name-only --diff-filter=U
    print_color "$YELLOW" "\nResolve conflicts manually, then run:"
    print_color "$YELLOW" "  git add <files>"
    print_color "$YELLOW" "  git rebase --continue"
    print_color "$YELLOW" "  git push --force-with-lease origin $branch"
    return 1
  fi
}

# Function to show menu
show_menu() {
  print_color "$GREEN" "\n📋 Feature Branch Rebase Menu"
  print_color "$GREEN" "================================"
  echo
  
  local i=1
  for branch in "${PRIORITY_BRANCHES[@]}"; do
    printf "%2d) %s\n" $i "$branch"
    if branch_exists "origin/$branch"; then
      printf "    Status: %s\n" "$(get_branch_status "origin/$branch")"
    else
      printf "    Status: %s\n" "Branch not found"
    fi
    ((i++))
  done
  
  echo
  echo " 0) Exit"
  echo
}

# Function to delete merged branches
delete_merged_branches() {
  print_color "$YELLOW" "\n📦 Checking for already-merged branches..."
  
  local merged_branches=(
    "claude/add-project-management-YN4Ob"
    "cursor/dashboard-notification-system-50b9"
  )
  
  for branch in "${merged_branches[@]}"; do
    if branch_exists "origin/$branch"; then
      print_color "$YELLOW" "Found merged branch: $branch"
      read -p "Delete this branch? (y/N) " -n 1 -r
      echo
      if [[ $REPLY =~ ^[Yy]$ ]]; then
        git push origin --delete "$branch"
        print_color "$GREEN" "✅ Deleted $branch"
      fi
    fi
  done
}

# Main script
main() {
  # Check if we're in a git repository
  if ! git rev-parse --git-dir > /dev/null 2>&1; then
    print_color "$RED" "Error: Not in a git repository"
    exit 1
  fi
  
  # Check if main branch exists
  if ! branch_exists "origin/main"; then
    print_color "$RED" "Error: origin/main branch not found"
    exit 1
  fi
  
  # If branch name provided as argument
  if [ $# -eq 1 ]; then
    if [ "$1" = "--delete-merged" ]; then
      delete_merged_branches
      exit 0
    else
      rebase_branch "$1"
      exit $?
    fi
  fi
  
  # Interactive menu
  while true; do
    show_menu
    read -p "Select a branch to rebase (or 0 to exit): " choice
    
    # Validate input is numeric
    if ! [[ $choice =~ ^[0-9]+$ ]]; then
      print_color "$RED" "Invalid choice: please enter a number"
      continue
    fi
    
    if [ "$choice" = "0" ]; then
      print_color "$GREEN" "Goodbye!"
      exit 0
    elif [ "$choice" -ge 1 ] && [ "$choice" -le "${#PRIORITY_BRANCHES[@]}" ]; then
      local idx=$((choice - 1))
      rebase_branch "${PRIORITY_BRANCHES[$idx]}"
      
      read -p "Press Enter to continue..." _
    else
      print_color "$RED" "Invalid choice"
    fi
  done
}

# Run main function
main "$@"
