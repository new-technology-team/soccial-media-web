import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Req, Query } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { JwtAuthGuard } from '../../common/guard/jwt-auth.guard';

@Controller('api/chat')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Get('conversations')
  @UseGuards(JwtAuthGuard)
  listConversations(@Req() req: any) {
    return this.conversationService.listConversations(req.user.sub);
  }

  @Post('conversations/direct')
  @UseGuards(JwtAuthGuard)
  createDirect(@Body() body: { userId: number }, @Req() req: any) {
    return this.conversationService.createDirect(req.user.sub, body.userId);
  }

  @Post('conversations/group')
  @UseGuards(JwtAuthGuard)
  createGroup(
    @Body() body: { name: string; memberIds: number[] },
    @Req() req: any,
  ) {
    return this.conversationService.createGroup(
      req.user.sub,
      body.name,
      body.memberIds || [],
    );
  }

  @Get('conversations/:id/messages')
  @UseGuards(JwtAuthGuard)
  getMessages(@Param('id') id: string, @Req() req: any, @Query('limit') limit?: string) {
    return this.conversationService.getMessages(
      id,
      req.user.sub,
      limit ? parseInt(limit, 10) : 30,
    );
  }

  @Post('conversations/:id/messages')
  @UseGuards(JwtAuthGuard)
  sendMessage(
    @Param('id') id: string,
    @Body() body: { type?: string; text?: string; mediaUrl?: string },
    @Req() req: any,
  ) {
    return this.conversationService.sendMessage(id, req.user.sub, body);
  }
}
