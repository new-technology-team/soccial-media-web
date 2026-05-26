'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Image, Smile, MapPin } from 'lucide-react'
import { useAuthStore } from '@/contexts/auth-store'
import { api } from '@/api/client'
import type { FeedPost } from '@/types'

export default function PostCreator({ onCreated }: { onCreated?: (post: FeedPost) => void }) {
  const [content, setContent] = useState('')
  const [isPosting, setIsPosting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const token = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)

  const handlePost = async () => {
    if (!content.trim() || !token) return

    setIsPosting(true)
    setErrorMsg('')
    try {
      const response = await api.createPost(token, { content })
      setContent('')
      onCreated?.(response.post)
    } catch (error) {
      console.error('Failed to post:', error)
      setErrorMsg('Đăng bài thất bại, vui lòng thử lại.')
    } finally {
      setIsPosting(false)
    }
  }

  return (
    <Card className="surface-card">
      <CardContent className="pt-6">
        <div className="flex gap-4">
          <Avatar className="w-10 h-10">
            <AvatarImage src={user?.avatarUrl || ''} />
            <AvatarFallback>{user?.fullName?.[0] || 'U'}</AvatarFallback>
          </Avatar>

          <div className="flex-1 space-y-4">
            <Textarea
              placeholder="Bạn đang nghĩ gì?"
              value={content}
              onChange={(e) => {
                setContent(e.target.value)
                if (errorMsg) setErrorMsg('')
              }}
              className="resize-none min-h-[100px]"
              disabled={isPosting}
            />
            {errorMsg ? <p className="text-sm text-destructive">{errorMsg}</p> : null}

            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Button variant="ghost" size="sm">
                  <Image className="w-4 h-4 mr-2" />
                  Ảnh
                </Button>
                <Button variant="ghost" size="sm">
                  <Smile className="w-4 h-4 mr-2" />
                  Cảm xúc
                </Button>
                <Button variant="ghost" size="sm">
                  <MapPin className="w-4 h-4 mr-2" />
                  Vị trí
                </Button>
              </div>

              <Button
                onClick={handlePost}
                disabled={!content.trim() || isPosting}
              >
                {isPosting ? 'Đang đăng...' : 'Đăng bài'}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

