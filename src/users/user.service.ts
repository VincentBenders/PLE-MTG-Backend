import {BadRequestException, Injectable, NotFoundException, UnauthorizedException} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import {LoginDto} from "./dto/login.dto";
import * as bcrypt from "bcrypt";
import {JwtService} from "@nestjs/jwt";

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}
  private readonly saltRounds = 10;

  async create(createUserDto: CreateUserDto) {
    const { password, ...userDetails } = createUserDto;
    const hashedPassword = await bcrypt.hash(password, this.saltRounds);

    const user = this.userRepository.create({ ...userDetails, password: hashedPassword });

    return await this.userRepository.save(user);
  }

  findAll() {
    return `This action returns all users`;
  }

  async findLogin(loginDto: LoginDto) {
    const user = await this.userRepository.findOne({
      where: {
        username: loginDto.username,
      },
      select: ['id', 'username', 'password'],
    });

    if (!user) {
      throw new NotFoundException('Invalid username or password');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const payload = { sub: user.id, username: user.username };

    const token = this.jwtService.sign(payload, { secret: 'JWT_TOKEN' });
    return {
      message: 'Login successful',
      accessToken: token,
    };
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    return `This action updates a #${id} user`;
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }
}
