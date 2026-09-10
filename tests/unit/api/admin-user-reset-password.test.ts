import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/admin/users/[id]/reset-password/route'
import { sendTemplatedEmail } from '@/lib/notifications/providers/email'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(),
}))

vi.mock('@/lib/notifications/providers/email', () => ({
  sendTemplatedEmail: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}))

const adminId = '92590224-7b83-4d85-a28b-af017c1ba204'
const targetUserId = '31784cdf-469c-4936-9219-34be1fe7fbc5'
const targetOrganizationId = 'd12abe39-5448-4563-9ac6-2dd53da9fcfc'
const recoveryLink = 'https://auth.example.com/verify?token=secret&type=recovery'

const createServerSupabaseClientMock = vi.mocked(createServerSupabaseClient)
const createClientMock = vi.mocked(createClient)
const sendTemplatedEmailMock = vi.mocked(sendTemplatedEmail)

function createServerClientFixture() {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: adminId } },
        error: null,
      }),
    },
    from: vi.fn((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn((_column: string, value: string) => ({
          single: vi.fn().mockResolvedValue(
            table === 'profiles'
              ? { data: { name: 'Client User' }, error: null }
              : value === adminId
                ? {
                    data: {
                      id: adminId,
                      email: 'admin@example.com',
                      role: 'super_admin',
                      organization_id: null,
                    },
                    error: null,
                  }
                : {
                    data: {
                      id: targetUserId,
                      email: 'client@example.com',
                      organization_id: targetOrganizationId,
                    },
                    error: null,
                  },
          ),
        })),
      })),
    })),
  }
}

async function resetPassword() {
  return POST(
    new Request(`http://localhost/api/admin/users/${targetUserId}/reset-password`, {
      method: 'POST',
    }),
    { params: Promise.resolve({ id: targetUserId }) },
  )
}

describe('admin user password reset API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://portal.example.com')

    createServerSupabaseClientMock.mockResolvedValue(createServerClientFixture() as never)
    createClientMock.mockReturnValue({
      auth: {
        admin: {
          generateLink: vi.fn().mockResolvedValue({
            data: { properties: { action_link: recoveryLink } },
            error: null,
          }),
        },
      },
    } as never)
  })

  it('reports delivery failure instead of claiming the reset email was sent', async () => {
    sendTemplatedEmailMock.mockResolvedValue({
      success: false,
      error: 'Email service not configured',
      provider: 'resend',
    })

    const response = await resetPassword()

    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({
      error: 'Password reset email could not be delivered. Check the email settings and try again.',
    })
  })

  it('sends the generated recovery link through the client organization email provider', async () => {
    sendTemplatedEmailMock.mockResolvedValue({
      success: true,
      messageId: 'message-123',
      provider: 'smtp',
    })

    const response = await resetPassword()

    expect(response.status).toBe(200)
    expect(sendTemplatedEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'client@example.com',
        templateType: 'password_reset',
        organizationId: targetOrganizationId,
        variables: expect.objectContaining({
          recipient_name: 'Client User',
          reset_link: recoveryLink,
          subject: 'Reset your KT-Portal password',
          message: expect.stringContaining(recoveryLink),
        }),
      }),
    )
    expect(await response.json()).toEqual({
      success: true,
      message: 'Password reset email accepted for delivery to client@example.com',
    })
  })
})
